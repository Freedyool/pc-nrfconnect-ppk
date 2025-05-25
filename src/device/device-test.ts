/*
 * Copyright (c) 2025 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import { fork } from 'child_process';
import EventEmitter from 'events';
import fs from 'fs';
import path from 'path';

import PPKCmd from '../constants';
import { convertBits16 } from '../utils/bitConversion';
import { Mask, modifiers, SampleValues, serialDeviceMessage } from './types';

/* eslint-disable @typescript-eslint/no-non-null-assertion -- TODO: Remove, only added for conservative refactoring to typescript */
/* eslint-disable @typescript-eslint/no-explicit-any -- TODO: Remove, only added for conservative refactoring to typescript */
/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable no-bitwise */

const generateMask = (bits: number, pos: number): Mask => ({
    pos,
    mask: (2 ** bits - 1) << pos,
});
const MEAS_ADC = generateMask(14, 0);
const MEAS_RANGE = generateMask(3, 14);
const MEAS_COUNTER = generateMask(6, 18);
const MEAS_LOGIC = generateMask(8, 24);

const MAX_PAYLOAD_COUNTER = 0b111111; // 0x3f, 64 - 1
const DATALOSS_THRESHOLD = 500; // 500 * 10us = 5ms: allowed loss

const getMaskedValue = (value: number, { mask, pos }: Mask): number =>
    (value & mask) >> pos;

interface DeviceTraits {
    usb?: boolean;
    nordicUsb?: boolean;
    nordicDfu?: boolean;
    seggerUsb?: boolean;
    jlink?: boolean;
    serialPorts?: boolean;
    broken?: boolean;
    mcuBoot?: boolean;
    modem?: boolean;
}

interface SharedDevice {
    id: number;
    traits: DeviceTraits;
    serialNumber?: string | null; // undefined in case udev is not installed
}

function convertFloatToByteBuffer(floatnum: number): Uint8Array {
    const float = new Float32Array(1);
    float[0] = floatnum;
    const bytes = new Uint8Array(float.buffer);
    return bytes;
}

class SerialDevice extends EventEmitter {
    public modifiers: modifiers = {
        r: [1031.64, 101.65, 10.15, 0.94, 0.043],
        gs: [1, 1, 1, 1, 1],
        gi: [1, 1, 1, 1, 1],
        o: [0, 0, 0, 0, 0],
        s: [0, 0, 0, 0, 0],
        i: [0, 0, 0, 0, 0],
        ug: [1, 1, 1, 1, 1],
    };

    private adcMult = 1.8 / 163840;
    private currentVdd = 3.0;
    private spikeFilter = {
        alpha: 0.18,
        alpha5: 0.06,
        samples: 3,
    };

    private channel: number;
    private path;
    private child;
    private parser: any;
    private expectedCounter: null | number;
    private dataLossCounter: number;
    private corruptedSamples: { value: number; bits: number }[];
    private rollingAvg: undefined | number;
    private rollingAvg4: undefined | number;
    private prevRange: undefined | number;
    private afterSpike: undefined | number;
    private consecutiveRangeSample: undefined | number;

    onSampleCallback;

    constructor(
        device: SharedDevice,
        onSampleCallback: (values: SampleValues, chan: number) => void,
        channel: number
    ) {
        super();
        this.onSampleCallback = onSampleCallback;

        this.channel = channel;

        this.path = 'COM9';
        // this.child = fork(path.resolve('worker', 'serialDevice.js'));
        this.child = fork(path.resolve('worker', 'virtualDevice.js'));

        this.child.on('message', (message: serialDeviceMessage) => {
            if (!this.parser) {
                console.error('Program logic error, parser is not set.');
                return;
            }

            if ('reply' in message && message.reply) {
                console.log('reply in message:', message);
                return;
            }

            if ('data' in message && message.data) {
                // console.log('data in message:', message);
                this.parser(Buffer.from(message.data));
                return;
            }
            console.log(`message: ${JSON.stringify(message)}`);
        });
        this.child.on('close', code => {
            if (code) {
                console.log(`Child process exited with code ${code}`);
            } else {
                console.log('Child process cleanly exited');
            }
        });

        this.expectedCounter = null;
        this.dataLossCounter = 0;
        this.corruptedSamples = [];
    }

    start() {
        this.child.send({ open: this.path });
        return this.getMetadata();
    }

    stop() {
        this.child.kill();
    }

    sendCommand(cmd: PPKCmd) {
        if (cmd.constructor !== Array) {
            this.emit(
                'error',
                'Unable to issue command',
                'Command is not an array'
            );
            return undefined;
        }
        if (cmd[0] === PPKCmd.AverageStart) {
            this.rollingAvg = undefined;
            this.rollingAvg4 = undefined;
            this.prevRange = undefined;
            this.consecutiveRangeSample = 0;
            this.afterSpike = 0;
        }
        console.log({ write: cmd });
        this.child.send({ write: cmd });
        return Promise.resolve(cmd.length);
    }

    getMetadata() {
        let metadata = '';
        return (
            new Promise(resolve => {
                this.parser = (data: Buffer) => {
                    metadata = `${metadata}${data}`;
                    if (metadata.includes('END')) {
                        // hopefully we have the complete string, HW is the last line
                        this.parser = this.parseProcessedData.bind(this);
                        resolve(metadata);
                    }
                };
                this.sendCommand([PPKCmd.GetMetadata]);
            })
                // convert output string json:
                .then(meta => {
                    // TODO: Is this the best way to handle this?
                    // What if typeof meta is not 'string', even though we never expect it,
                    // shouldn't we handle it anyway. And how should then handle it?
                    if (typeof meta === 'string') {
                        return meta
                            .replace('END', '')
                            .trim()
                            .toLowerCase()
                            .replace(/-nan/g, 'null')
                            .replace(/\n/g, ',\n"')
                            .replace(/: /g, '": ');
                    }
                })
                .then(meta => `{"${meta}}`)
                // resolve with parsed object:
                .then(JSON.parse)
        );
    }

    parseMeta(meta: any) {
        Object.entries(this.modifiers).forEach(
            ([modifierKey, modifierArray]) => {
                Array.from(modifierArray).forEach((modifier, index) => {
                    modifierArray[index] =
                        meta[`${modifierKey}${index}`] || modifier;
                });
            }
        );
        return meta;
    }

    resetDataLossCounter() {
        this.expectedCounter = null;
        this.dataLossCounter = 0;
        this.corruptedSamples = [];
    }

    dataLossReport(missingSamples: number) {
        if (
            this.dataLossCounter < DATALOSS_THRESHOLD &&
            this.dataLossCounter + missingSamples >= DATALOSS_THRESHOLD
        ) {
            console.log(
                'Data loss detected. See https://github.com/Nordicsemiconductor/pc-nrfconnect-ppk/blob/main/doc/docs/troubleshooting.md#data-loss-with-ppk2'
            );
        }
        this.dataLossCounter += missingSamples;
    }

    getAdcResult(range: number, adcVal: number): number {
        const resultWithoutGain =
            (adcVal - this.modifiers.o[range]) *
            (this.adcMult / this.modifiers.r[range]);
        let adc =
            this.modifiers.ug[range] *
            (resultWithoutGain *
                (this.modifiers.gs[range] * resultWithoutGain +
                    this.modifiers.gi[range]) +
                (this.modifiers.s[range] * (this.currentVdd / 1000) +
                    this.modifiers.i[range]));

        const prevRollingAvg4 = this.rollingAvg4;
        const prevRollingAvg = this.rollingAvg;

        this.rollingAvg =
            this.rollingAvg === undefined
                ? adc
                : this.spikeFilter.alpha * adc +
                  (1.0 - this.spikeFilter.alpha) * this.rollingAvg;
        this.rollingAvg4 =
            this.rollingAvg4 === undefined
                ? adc
                : this.spikeFilter.alpha5 * adc +
                  (1.0 - this.spikeFilter.alpha5) * this.rollingAvg4;

        if (this.prevRange === undefined) {
            this.prevRange = range;
        }

        if (this.prevRange !== range || this.afterSpike! > 0) {
            if (this.prevRange !== range) {
                // number of measurements after the spike which still to be averaged
                this.consecutiveRangeSample = 0;
                this.afterSpike = this.spikeFilter.samples;
            } else {
                this.consecutiveRangeSample! += 1;
            }
            // Use previous rolling average if within first two samples of range 4
            if (range === 4) {
                if (this.consecutiveRangeSample! < 2) {
                    this.rollingAvg4 = prevRollingAvg4;
                    this.rollingAvg = prevRollingAvg;
                }
                adc = this.rollingAvg4!;
            } else {
                adc = this.rollingAvg;
            }
            // adc = range === 4 ? this.rollingAvg4 : this.rollingAvg;
            this.afterSpike! -= 1;
        }
        this.prevRange = range;

        return adc;
    }

    handleRawDataSet(adcValue: number) {
        try {
            const currentMeasurementRange = Math.min(
                getMaskedValue(adcValue, MEAS_RANGE),
                this.modifiers.r.length
            );
            const counter = getMaskedValue(adcValue, MEAS_COUNTER);
            const adcResult = getMaskedValue(adcValue, MEAS_ADC) * 4;
            const bits = getMaskedValue(adcValue, MEAS_LOGIC);
            const value =
                this.getAdcResult(currentMeasurementRange, adcResult) * 1e6;

            if (this.expectedCounter === null) {
                this.expectedCounter = counter;
            } else if (
                this.corruptedSamples.length > 0 &&
                counter === this.expectedCounter
            ) {
                while (this.corruptedSamples.length > 0) {
                    this.onSampleCallback(
                        this.corruptedSamples.shift()!,
                        this.channel
                    );
                }
                this.corruptedSamples = [];
            } else if (this.corruptedSamples.length > 4) {
                const missingSamples =
                    (counter - this.expectedCounter + MAX_PAYLOAD_COUNTER) &
                    MAX_PAYLOAD_COUNTER;
                this.dataLossReport(missingSamples);
                for (let i = 0; i < missingSamples; i += 1) {
                    this.onSampleCallback({}, this.channel);
                }
                this.expectedCounter = counter;
                this.corruptedSamples = [];
            } else if (this.expectedCounter !== counter) {
                this.corruptedSamples.push({ value, bits });
            }

            this.expectedCounter += 1;
            this.expectedCounter &= MAX_PAYLOAD_COUNTER;
            // Only fire the event, if the buffer data is valid
            this.onSampleCallback({ value, bits }, this.channel);
        } catch (err: unknown) {
            // TODO: This does not consistently handle all possibilites
            // Even though we expect all err to be instance of Error we should
            // probably also include an else and potentially log it to ensure all
            // branches are considered.
            if (err instanceof Error) {
                console.log(err.message, 'original value', adcValue);
            }
            // to keep timestamp consistent, undefined must be emitted
            this.onSampleCallback({}, this.channel);
        }
    }

    remainder = Buffer.alloc(0);
    timeStamp = Date.now();

    parseProcessedData(buf: Buffer) {
        const timeStamp = Date.now();
        console.log(buf);
        const sampleSize = 10;
        for (let i = 0; i < buf.length / sampleSize; i += 1) {
            const value = buf.readDoubleLE(i * sampleSize);
            const bits = buf.readUint16LE(i * sampleSize + 8);
            // console.log(`value: ${value}, bits: ${bits}`);
            this.onSampleCallback({ value, bits }, this.channel);
        }
        console.log(
            `[${timeStamp - this.timeStamp}] Trunk size: ${
                buf.length
            } Bytes, which costs ${Date.now() - timeStamp}ms to handle.`
        );
        this.timeStamp = timeStamp;
    }

    parseMeasurementData(buf: Buffer) {
        const timeStamp = Date.now();
        const sampleSize = 4;
        let ofs = this.remainder.length;
        const first = Buffer.concat(
            [this.remainder, buf.subarray(0, sampleSize - ofs)],
            sampleSize
        );
        ofs = sampleSize - ofs;
        this.handleRawDataSet(first.readUIntLE(0, sampleSize));
        for (; ofs <= buf.length - sampleSize; ofs += sampleSize) {
            this.handleRawDataSet(buf.readUIntLE(ofs, sampleSize));
        }
        console.log(
            `[${timeStamp - this.timeStamp}] Trunk size: ${
                buf.length
            } Bytes, which costs ${Date.now() - timeStamp}ms to handle.`
        );
        this.timeStamp = timeStamp;
        this.remainder = buf.subarray(ofs);
    }

    ppkSetPowerMode(isSmuMode: boolean): Promise<unknown> {
        return this.sendCommand([PPKCmd.SetPowerMode, isSmuMode ? 2 : 1])!;
    }

    ppkSetUserGains(range: number, gain: number): Promise<unknown> {
        this.modifiers.ug[range] = gain;
        return this.sendCommand([
            PPKCmd.SetUserGains,
            range,
            ...convertFloatToByteBuffer(gain),
        ])!;
    }

    ppkAverageStart() {
        this.resetDataLossCounter();
        return this.sendCommand([PPKCmd.AverageStart])!;
    }

    ppkAverageStop(): Promise<unknown> {
        return this.sendCommand([PPKCmd.AverageStop])!;
    }

    ppkDeviceRunning(...args: PPKCmd): Promise<unknown> {
        return this.sendCommand([PPKCmd.DeviceRunningSet, ...args])!;
    }

    ppkUpdateRegulator(vdd: number): Promise<unknown> {
        this.currentVdd = vdd;

        return this.sendCommand([PPKCmd.RegulatorSet, vdd >> 8, vdd & 0xff])!;
    }
}

const frameSize = 6; // 2 bytes for float, 2 bytes for uint16, 2 bytes for uint8

const tempBuffer = new Uint8Array(frameSize);
const tempView = new DataView(tempBuffer.buffer);

const deviceInfo: SharedDevice = {
    id: 0,
    traits: {},
    serialNumber: 'Virtual Device',
};

let device: null | SerialDevice = null;

// 创建一个可以写入的流，写入到文件 output.txt 中
const writerStream = fs.createWriteStream('output.txt');

// 处理流事件 --> finish、error
writerStream.on('finish', () => {
    device!.ppkAverageStop();
    device!.stop();
    console.log('写入完成。');
});

writerStream.on('error', err => {
    console.log(err.stack);
});

let sampleCount = 0;

const onSample = ({ value, bits }: SampleValues, chan: number) => {
    const logic = convertBits16(bits!);
    const current = value ?? 0.2;

    tempView.setFloat32(0, current, true);
    tempView.setUint16(4, logic);

    sampleCount += 1;

    // if (sampleCount < 10) {
    if (sampleCount < 100_000 * 10) {
        // 使用 utf8 编码写入数据
        writerStream.write(tempBuffer, 'binary');
    } else {
        // 标记文件末尾
        writerStream.end();
    }
};

const openDevice = async () => {
    device = new SerialDevice(deviceInfo, onSample, 0);

    const metadata = device.parseMeta(await device.start());

    console.log(metadata);

    await device.ppkUpdateRegulator(metadata.vdd); // set VDD

    const { ug } = device.modifiers;
    // if any value is ug is outside of [0.9..1.1] range:
    if (ug.reduce((p, c) => Math.abs(c - 1) > 0.1 || p, false)) {
        console.log(
            'Found out-of-range user gain, setting all gains back to 1.0'
        );
        ug.splice(0, 5, 1, 1, 1, 1, 1);
        await device.ppkSetUserGains(0, ug[0]);
        await device.ppkSetUserGains(1, ug[1]);
        await device.ppkSetUserGains(2, ug[2]);
        await device.ppkSetUserGains(3, ug[3]);
        await device.ppkSetUserGains(4, ug[4]);
    }

    await device.ppkSetPowerMode(true); // set to source mode
    // await device!.ppkSetPowerMode(false); // set to ampere mode

    await device.ppkDeviceRunning(1); // turn on power supply
    // await device!.ppkDeviceRunning(0); // turn off power supply

    await device.ppkAverageStart();
};

openDevice()
    .then(() => {
        console.log('Device opened');
    })
    .catch(err => {
        console.error('Error opening device:', err);
    });
