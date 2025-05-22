/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import { getCurrentWindow } from '@electron/remote';
import path from 'path';
import { v4 } from 'uuid';

import { FileBuffer } from './utils/FileBuffer';
import { FoldingBuffer } from './utils/foldingBuffer';
import { fullOverlap, Range, WriteBuffer } from './utils/WriteBuffer';

export const currentFrameSize = 4;
export const bitFrameSize = 2; // 6 bytes, 4 current 2 buts
export const frameSize = currentFrameSize + bitFrameSize; // 6 bytes, 4 current 2 buts
export const bufferLengthInSeconds = 60 * 5;
export const numberOfDigitalChannels = 8;

const initialSamplingTime = 10;
const initialSamplesPerSecond = 1e6 / initialSamplingTime;
export const microSecondsPerSecond = 1e6;

const tempBuffers: Uint8Array[] = [];
const tempViews: DataView[] = [];

export interface GlobalOptions {
    /** The number of samples per second */
    samplesPerSecond: number;
    /** @var index: pointer to the index of the last sample in data array */
    fileBuffer: FileBuffer[];
    writeBuffer: WriteBuffer[];
    foldingBuffer: FoldingBuffer[];
    timeReachedTriggers: {
        timeRange: Range;
        bytesRange: Range;
        triggerOrigin: number;
        onSuccess: (writeBuffer: WriteBuffer, absoluteTime: number) => void;
        onFail: (error: Error) => void;
    }[];
    inSyncOffset: number;
    lastInSyncTime: number;
}

const options: GlobalOptions = {
    samplesPerSecond: initialSamplesPerSecond,
    timeReachedTriggers: [],
    fileBuffer: [],
    writeBuffer: [],
    foldingBuffer: [],
    inSyncOffset: 0,
    lastInSyncTime: 0,
};

class FileData {
    data: Uint8Array;
    dataView: DataView;
    length: number;
    constructor(data: Readonly<Uint8Array>, length: number) {
        this.data = data;
        this.length = length;
        this.dataView = new DataView(this.data.buffer);
    }

    getAllCurrentData() {
        const numberOfElements = this.getLength();
        const result = new Uint8Array(numberOfElements * currentFrameSize);
        for (let index = 0; index < numberOfElements; index += 1) {
            const byteOffset = index * frameSize;
            result.set(
                this.data.subarray(byteOffset, byteOffset + currentFrameSize),
                index * currentFrameSize
            );
        }

        return new Float32Array(result.buffer);
    }

    getCurrentData(index: number) {
        const byteOffset = index * frameSize;

        if (this.length < byteOffset + currentFrameSize) {
            throw new Error('Index out of range');
        }

        return this.dataView.getFloat32(byteOffset, true);
    }

    getAllBitData() {
        const numberOfElements = this.getLength();
        const result = new Uint8Array(numberOfElements * 2);
        for (let index = 0; index < numberOfElements; index += 1) {
            const bitValue = this.getBitData(index);
            // eslint-disable-next-line no-bitwise
            result.set([bitValue & 0xff, (bitValue >> 8) & 0xff], index * 2);
        }

        return new Uint16Array(result.buffer);
    }

    getBitData(index: number) {
        const byteOffset = index * frameSize + currentFrameSize;

        if (this.length < byteOffset + 2) {
            throw new Error('Index out of range');
        }

        return this.dataView.getUint16(byteOffset);
    }

    getLength() {
        return this.length / frameSize;
    }
}

const getTimestamp = (chan = 0) =>
    !options.fileBuffer[chan]
        ? 0
        : indexToTimestamp(
              options.fileBuffer[chan].getSessionInBytes() / frameSize - 1
          );

export const normalizeTimeFloor = (time: number) =>
    indexToTimestamp(timestampToIndex(time));

export const normalizeTimeCeil = (time: number) =>
    indexToTimestamp(timestampToCeilIndex(time));

export const DataManager = () => ({
    getSamplingTime: () => getSamplingTime(options.samplesPerSecond),
    getSamplesPerSecond: () => options.samplesPerSecond,
    setSamplesPerSecond: (samplesPerSecond: number) => {
        options.samplesPerSecond = samplesPerSecond;
    },
    getSessionFolder: (chan = 0) =>
        options.fileBuffer[chan]?.getSessionFolder(),
    getData: async (
        buffer: Buffer,
        fromTime = 0,
        toTime = getTimestamp(),
        bias: 'start' | 'end' | undefined = undefined,
        onLoading: (loading: boolean) => void = () => {},
        chan = 0
    ) => {
        // NOTE: only one getData per buffer should bhe executed at any given time

        if (options.fileBuffer[chan] === undefined) {
            return new FileData(Buffer.alloc(0), 0);
        }

        if (options.fileBuffer[chan].getSessionInBytes() === 0) {
            return new FileData(Buffer.alloc(0), 0);
        }

        const numberOfElements =
            timestampToIndex(toTime) - timestampToIndex(fromTime) + 1;
        const byteOffset = timestampToIndex(fromTime) * frameSize;
        const numberOfBytesToRead = numberOfElements * frameSize;

        if (buffer.length < numberOfBytesToRead) {
            throw new Error('Buffer is too small');
        }

        const readBytes = await options.fileBuffer[chan].read(
            buffer,
            byteOffset,
            numberOfBytesToRead,
            bias,
            onLoading
        );

        if (readBytes !== numberOfBytesToRead) {
            console.log(
                `missing ${
                    (numberOfBytesToRead - readBytes) / frameSize
                } records`
            );
        }
        return new FileData(buffer, readBytes);
    },
    getAllData: (
        buffers: Buffer[],
        fromTime = 0,
        toTime = getTimestamp(),
        bias: 'start' | 'end' | undefined = undefined,
        onLoading: (loading: boolean) => void = () => {}
    ) => {
        if (buffers.length !== options.fileBuffer.length) {
            throw new Error(
                `Buffers length ${buffers.length} does not match fileBuffer length ${options.fileBuffer.length}`
            );
        }
        return options.fileBuffer.map(async (buffer, index) => {
            if (buffer === undefined) {
                return new FileData(Buffer.alloc(0), 0);
            }

            if (buffer.getSessionInBytes() === 0) {
                return new FileData(Buffer.alloc(0), 0);
            }

            const numberOfElements =
                timestampToIndex(toTime) - timestampToIndex(fromTime) + 1;
            const byteOffset = timestampToIndex(fromTime) * frameSize;
            const numberOfBytesToRead = numberOfElements * frameSize;

            if (buffers[index].length < numberOfBytesToRead) {
                throw new Error('Buffer is too small');
            }

            const readBytes = await buffer.read(
                buffers[index],
                byteOffset,
                numberOfBytesToRead,
                bias,
                onLoading
            );

            if (readBytes !== numberOfBytesToRead) {
                console.log(
                    `missing ${
                        (numberOfBytesToRead - readBytes) / frameSize
                    } records`
                );
            }
            return new FileData(buffers[index], readBytes);
        });
    },

    getTimestamp,
    isInSync: (chan = 0) => {
        const firstWriteTime =
            options.writeBuffer[chan]?.getFirstWriteTime() ??
            options.fileBuffer[chan]?.getFirstWriteTime() ??
            0;

        if (firstWriteTime === 0) return true;

        const actualTimePassed = Date.now() - firstWriteTime;

        const processedBytes =
            options.writeBuffer[chan]?.getBytesWritten() ??
            options.fileBuffer[chan]?.getSessionInBytes() ??
            0;

        const simulationDelta =
            indexToTimestamp(processedBytes / frameSize - 1) / 1000;
        if (simulationDelta > actualTimePassed) return true;

        const pcAheadDelta = actualTimePassed - simulationDelta;

        // We get serial data every 30 ms regardless of sampling rate.
        // If PC is ahead by more then 1.5 samples we are not in sync
        let inSync = pcAheadDelta - options.inSyncOffset <= 45;

        if (inSync) {
            options.lastInSyncTime = Date.now();
        }

        // If Data is lost in the serial and this was not detected we need to resync the timers so we do not get stuck rendering at 1 FPS
        // NOTE: this is temporary fix until PPK protocol can handle data loss better
        if (Date.now() - options.lastInSyncTime >= 1000) {
            options.lastInSyncTime = Date.now();
            options.inSyncOffset = actualTimePassed - simulationDelta;
            inSync = true;
        }

        return inSync;
    },
    getStartSystemTime: (chan = 0) =>
        options.fileBuffer[chan]?.getFirstWriteTime(),

    addData: (current: number, bits: number, chan = 0) => {
        if (
            options.fileBuffer[chan] === undefined &&
            options.writeBuffer[chan] === undefined
        )
            return;

        if (tempViews[chan] === undefined || tempBuffers[chan] === undefined) {
            tempBuffers[chan] = new Uint8Array(6);
            tempViews[chan] = new DataView(tempBuffers[chan].buffer);
        }

        tempViews[chan].setFloat32(0, current, true);
        tempViews[chan].setUint16(4, bits);

        if (options.writeBuffer[chan]) {
            options.writeBuffer[chan].append(tempBuffers[chan]);
        } else {
            options.fileBuffer[chan]?.append(tempBuffers[chan]);
            options.foldingBuffer[chan]?.addData(current, getTimestamp());
        }

        const writeBuffer = options.writeBuffer[chan];
        if (writeBuffer) {
            const timestamp = indexToTimestamp(
                writeBuffer.getBytesWritten() / frameSize - 1
            );
            const readyTriggers = options.timeReachedTriggers.filter(
                trigger => trigger.timeRange.end <= timestamp
            );
            readyTriggers.forEach(trigger => {
                const bufferedRangeBytes = writeBuffer.getBufferRange();

                if (fullOverlap(bufferedRangeBytes, trigger.bytesRange)) {
                    trigger.onSuccess(
                        writeBuffer,
                        (writeBuffer.getFirstWriteTime() ?? 0) +
                            trigger.timeRange.start / 1000 // micro to milli
                    );
                } else {
                    trigger.onFail(
                        new Error(
                            'Buffer is too small, missing data from range'
                        )
                    );
                }
            });

            options.timeReachedTriggers = options.timeReachedTriggers.filter(
                trigger => trigger.timeRange.end > timestamp
            );
        }
    },
    flush: (chan = 0) => options.fileBuffer[chan]?.flush(),
    reset: async () => {
        options.timeReachedTriggers.forEach(trigger => {
            trigger.onFail(new Error('Trigger Aborted'));
        });
        options.timeReachedTriggers = [];
        const res = options.fileBuffer.map(buffer => buffer?.close());
        await Promise.all(res);
        options.fileBuffer.forEach(buffer => buffer?.release());
        options.fileBuffer = [];
        options.writeBuffer = [];
        options.foldingBuffer = [];
        options.samplesPerSecond = initialSamplesPerSecond;
        options.inSyncOffset = 0;
    },
    initializeLiveSession: (sessionRootPath: string, chan = 0) => {
        const sessionPath = path.join(sessionRootPath, v4());

        options.fileBuffer[chan] = new FileBuffer(
            10 * 100_000 * frameSize, // 6 bytes per sample for and 10sec buffers at highest sampling rate
            sessionPath,
            14,
            14
        );
        options.foldingBuffer[chan] = new FoldingBuffer();
    },
    initializeTriggerSession: (timeToRecordSeconds: number, chan = 0) => {
        options.writeBuffer[chan] = new WriteBuffer(
            timeToRecordSeconds * getSamplesPerSecond() * frameSize
        );
    },
    createSessionData: async (
        buffer: Uint8Array,
        sessionRootPath: string,
        startSystemTime: number,
        onProgress?: (message: string, progress?: number) => void
    ) => {
        const sessionPath = path.join(sessionRootPath, v4());

        const fileBuffer = new FileBuffer(
            10 * 100_000 * frameSize, // 6 bytes per sample for and 10sec buffers at highest sampling rate
            sessionPath,
            2,
            30,
            startSystemTime
        );
        const foldingBuffer = new FoldingBuffer();

        const fileData = new FileData(buffer, buffer.length);

        onProgress?.('Preparing Session');
        await fileBuffer.append(buffer);

        onProgress?.('Preparing Minimap', 0);
        let progress = 0;
        for (let i = 0; i < fileData.getLength(); i += 1) {
            const newProgress = Math.trunc((i / fileData.getLength()) * 100);
            if (newProgress !== progress) {
                onProgress?.('Preparing Minimap', newProgress);
                progress = newProgress;
            }

            foldingBuffer.addData(
                fileData.getCurrentData(i),
                i * getSamplingTime(options.samplesPerSecond)
            );
        }

        return { fileBuffer, foldingBuffer };
    },

    getTotalSavedRecords: () => timestampToIndex(getTimestamp()) + 1,

    loadData: (sessionPath: string, startSystemTime?: number, chan = 0) => {
        options.fileBuffer[chan] = new FileBuffer(
            10 * 100_000 * 6, // 6 bytes per sample for and 10sec buffers at highest sampling rate
            sessionPath,
            2,
            30,
            startSystemTime
        );
        options.foldingBuffer[chan] = new FoldingBuffer();
        options.foldingBuffer[chan].loadFromFile(sessionPath);
    },
    loadSession: (
        fileBuffer: FileBuffer,
        foldingBuffer: FoldingBuffer,
        chan = 0
    ) => {
        options.fileBuffer[chan] = fileBuffer;
        options.foldingBuffer[chan] = foldingBuffer;
    },
    getNumberOfSamplesInWindow: (windowDuration: number) =>
        timestampToIndex(windowDuration),
    getMinimapData: (chan = 0) => options.foldingBuffer[chan]?.getData() ?? [],
    getSessionBuffers: (chan = 0) => {
        if (!options.fileBuffer || !options.foldingBuffer) {
            throw new Error('One or buffer was missing ');
        }

        return {
            fileBuffer: options.fileBuffer[chan],
            foldingBuffer: options.foldingBuffer[chan],
        };
    },
    addTimeReachedTrigger: (recordingLengthMicroSeconds: number) =>
        new Promise<{
            writeBuffer: WriteBuffer;
            timeRange: Range;
            bytesRange: Range;
            absoluteTime: number;
            triggerOrigin: number;
        }>((resolve, reject) => {
            if (!options.writeBuffer) {
                reject(new Error('No write buffer initialized'));
                return;
            }

            const currentIndex = options.writeBuffer.reduce(
                (acc, buffer) =>
                    Math.min(acc, buffer.getBytesWritten() / frameSize - 1),
                0
            );
            const timestamp = indexToTimestamp(currentIndex);

            const splitRecordingLengthMicroSeconds =
                recordingLengthMicroSeconds / 2;
            const timeRange = {
                start: Math.max(
                    0,
                    timestamp - splitRecordingLengthMicroSeconds
                ),
                end:
                    timestamp +
                    splitRecordingLengthMicroSeconds -
                    indexToTimestamp(1), // we must exclude current sample the one that triggered all this
            };

            const bytesRange = {
                start: timestampToIndex(timeRange.start) * frameSize,
                end: (timestampToIndex(timeRange.end) + 1) * frameSize - 1,
            };

            const triggerOrigin =
                currentIndex - timestampToIndex(timeRange.start);

            options.timeReachedTriggers.push({
                timeRange,
                bytesRange,
                triggerOrigin,
                onSuccess: (writeBuffer, absoluteTime) =>
                    resolve({
                        writeBuffer,
                        timeRange, // with respect to the write buffer
                        bytesRange,
                        absoluteTime,
                        triggerOrigin,
                    }),
                onFail: (error: Error) => reject(error),
            });
        }),
    hasPendingTriggers: () => options.timeReachedTriggers.length > 0,
    onFileWrite: (listener: () => void, chan = 0) =>
        options.fileBuffer[chan]?.onFileWrite(listener),
});

/**
 * Get the sampling time derived from samplesPerSecond
 * @param {number} samplingRate number of samples per second
 * @returns {number} samplingTime which is the time in microseconds between samples
 */
const getSamplingTime = (samplingRate: number): number =>
    microSecondsPerSecond / samplingRate;

export const getSamplesPerSecond = () => options.samplesPerSecond;

export const timestampToIndex = (
    timestamp: number,
    samplesPerSecond: number = options.samplesPerSecond
): number =>
    timestamp < 0
        ? -1
        : Math.trunc((timestamp * samplesPerSecond) / microSecondsPerSecond);

export const timestampToCeilIndex = (timestamp: number): number =>
    timestamp < 0
        ? -1
        : Math.ceil(
              (timestamp * options.samplesPerSecond) / microSecondsPerSecond
          );

export const indexToTimestamp = (
    index: number,
    samplesPerSecond: number = options.samplesPerSecond
): number =>
    index >= 0 ? (microSecondsPerSecond * index) / samplesPerSecond : 0;

export const updateTitle = (info?: string | null) => {
    const title = getCurrentWindow().getTitle().split(':')[0].trim();
    getCurrentWindow().setTitle(`${title}${info ? ':' : ''} ${info || ''}`);
};
