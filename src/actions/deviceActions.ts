/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

/* eslint-disable no-bitwise */
/* eslint-disable @typescript-eslint/no-non-null-assertion -- TODO: Remove, only added for conservative refactoring to typescript */

import {
    AppThunk,
    Device,
    logger,
} from '@nordicsemiconductor/pc-nrfconnect-shared';
import describeError from '@nordicsemiconductor/pc-nrfconnect-shared/src/logging/describeError';
import { unit } from 'mathjs';

import { resetCache } from '../components/Chart/data/dataAccumulator';
import SerialDevice from '../device/serialDevice';
import { SampleValues } from '../device/types';
import {
    miniMapAnimationAction,
    resetMinimap,
    triggerForceRerender as triggerForceRerenderMiniMap,
} from '../features/minimap/minimapSlice';
import { startPreventSleep, stopPreventSleep } from '../features/preventSleep';
import {
    DataManager,
    frameSize,
    indexToTimestamp,
    microSecondsPerSecond,
} from '../globals';
import { RootState } from '../slices';
import {
    clearFileLoadedAction,
    deviceClosedAction,
    deviceOpenedAction,
    getDiskFullTrigger,
    getSessionRootFolder,
    isSavePending,
    samplingStartAction,
    samplingStoppedAction,
    setDeviceRunningAction,
    setPowerModeAction,
    setSavePending,
    updateCurrentDeviceAction,
} from '../slices/appSlice';
import {
    animationAction,
    chartWindowAction,
    chartWindowUnLockAction,
    clearRecordingMode,
    getRecordingMode,
    RecordingMode,
    resetChartTime,
    resetCursorAndChart,
    setLatestDataTimestamp,
    setRecordingMode,
    triggerForceRerender as triggerForceRerenderMainChart,
} from '../slices/chartSlice';
import {
    getSampleFrequency,
    setSamplingAttrsAction,
} from '../slices/dataLoggerSlice';
import { updateGainsAction } from '../slices/gainsSlice';
import { setCurrentSelector } from '../slices/multiDeviceSlice';
import {
    clearProgress,
    getTriggerRecordingLength,
    resetTriggerOrigin,
    setProgress,
    setTriggerActive,
    setTriggerOrigin,
} from '../slices/triggerSlice';
import { updateRegulator as updateRegulatorAction } from '../slices/voltageRegulatorSlice';
import { convertBits16 } from '../utils/bitConversion';
import { convertTimeToSeconds } from '../utils/duration';
import { isDiskFull } from '../utils/fileUtils';
import {
    addDevice,
    getAllDevice,
    getDevice,
    getDeviceCount,
    MultiDeviceItem,
    removeDevice,
    updateDevice,
    updateDeviceByChannel,
} from '../utils/multiDevice';
import {
    isDataLoggerPane,
    isMultiDevicePane,
    isScopePane,
} from '../utils/panes';
import { setSpikeFilter as persistSpikeFilter } from '../utils/persistentStore';

let device: null | SerialDevice = null;
let channel: null | number = null;
let updateRequestInterval: NodeJS.Timeout | undefined;
let releaseFileWriteListener: (() => void) | undefined;

export const setupOptions =
    (recordingMode: RecordingMode): AppThunk<RootState, Promise<void>> =>
    async (dispatch, getState) => {
        if (getDeviceCount() === 0) return;
        try {
            await DataManager().reset();
            dispatch(resetChartTime());
            dispatch(resetMinimap());

            switch (recordingMode) {
                case 'DataLogger':
                    DataManager().initializeLiveSession(
                        getSessionRootFolder(getState()),
                        channel ?? 0
                    );
                    break;
                case 'Scope':
                    DataManager().initializeTriggerSession(60);
                    break;
                case 'MultiDevice':
                    getAllDevice().forEach((dev, chan) => {
                        if (dev) {
                            DataManager().initializeLiveSession(
                                getSessionRootFolder(getState()),
                                chan
                            );
                        }
                    });
                    break;
            }

            releaseFileWriteListener?.();
            releaseFileWriteListener = DataManager().onFileWrite?.(() => {
                isDiskFull(
                    getDiskFullTrigger(getState()),
                    getSessionRootFolder(getState())
                ).then(isFull => {
                    if (isFull) {
                        logger.warn(
                            'Session stopped. Disk full trigger value reached.'
                        );
                        dispatch(samplingStop());
                    }
                });
            });
        } catch (err) {
            logger.error(err);
        }
        dispatch(chartWindowUnLockAction());
        dispatch(animationAction());
    };

// Only used by Data Logger Pane
/* Start reading current measurements */
export const samplingStart =
    (): AppThunk<RootState, Promise<void>> => async (dispatch, getState) => {
        const mode: RecordingMode =
            (isDataLoggerPane(getState()) && 'DataLogger') ||
            (isScopePane(getState()) && 'Scope') ||
            (isMultiDevicePane(getState()) && 'MultiDevice') ||
            'None';

        dispatch(setRecordingMode(mode));
        dispatch(setTriggerActive(false));
        dispatch(resetTriggerOrigin());
        // Prepare global options
        await dispatch(setupOptions(mode));

        dispatch(resetCursorAndChart());
        dispatch(samplingStartAction());

        const sampleFreq = getSampleFrequency(getState());

        switch (mode) {
            case 'DataLogger':
            case 'MultiDevice':
                DataManager().setSamplesPerSecond(sampleFreq);
                break;
            case 'Scope':
                DataManager().setSamplesPerSecond(100_000);
                break;
        }
        const res = getAllDevice().map(dev => dev?.ppkAverageStart());
        await Promise.all(res);
        startPreventSleep();
    };

export const samplingStop =
    (): AppThunk<RootState, Promise<void>> => async dispatch => {
        latestTrigger = undefined;
        if (getDeviceCount() === 0) return;
        dispatch(clearRecordingMode());
        dispatch(samplingStoppedAction());
        const res = getAllDevice().map(dev => dev?.ppkAverageStop());
        await Promise.all(res);
        stopPreventSleep();
        releaseFileWriteListener?.();
    };

export const updateSpikeFilter = (): AppThunk<RootState> => (_, getState) => {
    const { spikeFilter } = getState().app;
    persistSpikeFilter(spikeFilter);
    device!.ppkSetSpikeFilter(spikeFilter);
};

export const close =
    (sel: number): AppThunk<RootState, Promise<void>> =>
    async (dispatch, getState) => {
        const dev = getDevice(sel)?.device.device;
        clearInterval(updateRequestInterval);
        if (!dev) {
            return;
        }
        if (getState().app.app.samplingRunning) {
            await dispatch(samplingStop());
        }

        await dev.stop();
        dev.removeAllListeners();
        removeDevice(sel);

        if (getDeviceCount() === 0) {
            dispatch(deviceClosedAction());
        }

        logger.info('PPK closed', sel);
    };

const initGains = (): AppThunk<RootState, Promise<void>> => async dispatch => {
    if (!device!.capabilities.ppkSetUserGains) {
        return;
    }
    const { ug } = device!.modifiers;
    // if any value is ug is outside of [0.9..1.1] range:
    if (ug.reduce((p, c) => Math.abs(c - 1) > 0.1 || p, false)) {
        logger.info(
            'Found out-of-range user gain, setting all gains back to 1.0'
        );
        ug.splice(0, 5, 1, 1, 1, 1, 1);
        await device!.ppkSetUserGains(0, ug[0]);
        await device!.ppkSetUserGains(1, ug[1]);
        await device!.ppkSetUserGains(2, ug[2]);
        await device!.ppkSetUserGains(3, ug[3]);
        await device!.ppkSetUserGains(4, ug[4]);
    }
    [0, 1, 2, 3, 4].forEach(n =>
        dispatch(updateGainsAction({ value: ug[n] * 100, range: n }))
    );
};

export const open =
    (sel: number, deviceInfo: Device): AppThunk<RootState, Promise<void>> =>
    async (dispatch, getState) => {
        // TODO: Check if this is right?
        // Is this suppose to be run when another device is already connected?
        // Seems like it closes old device somewhere else first, meaning this is redundant.
        if (getDevice(sel)?.device.device) {
            await dispatch(close(sel));
        }

        let prevValue = 0;
        let prevCappedValue: number | undefined;
        let prevBits = 0;
        let nbSamples = 0;
        let nbSamplesTotal = 0;

        const onSample = ({ value, bits }: SampleValues, chan: number) => {
            const {
                app: { samplingRunning },
                dataLogger: { maxSampleFreq },
            } = getState().app;
            const sampleFreq = getSampleFrequency(getState());
            if (!samplingRunning) {
                return;
            }

            let cappedValue = value ?? 0.2;
            // PPK 2 can only read till 200nA (0.2uA)
            if (cappedValue < 0.2) {
                cappedValue = 0;
            }

            const b16 = convertBits16(bits!);

            if (samplingRunning && sampleFreq < maxSampleFreq) {
                const samplesPerAverage = maxSampleFreq / sampleFreq;
                nbSamples += 1;
                nbSamplesTotal += 1;
                const f = Math.min(nbSamplesTotal, samplesPerAverage);
                if (Number.isFinite(value) && Number.isFinite(prevValue)) {
                    cappedValue = prevValue + (cappedValue - prevValue) / f;
                }
                if (nbSamples < samplesPerAverage) {
                    if (value !== undefined) {
                        prevValue = cappedValue;
                        prevBits |= b16;
                    }
                    return;
                }
                nbSamples = 0;
            }

            DataManager().addData(cappedValue, b16 | prevBits, chan);
            prevBits = 0;

            if (getRecordingMode(getState()) === 'Scope') {
                const validTriggerValue =
                    prevCappedValue != null &&
                    prevCappedValue < getState().app.trigger.level &&
                    cappedValue >= getState().app.trigger.level;
                prevCappedValue = cappedValue;

                if (!DataManager().isInSync()) {
                    return;
                }

                if (!getState().app.trigger.active && validTriggerValue) {
                    if (latestTrigger !== undefined) {
                        return;
                    }

                    if (!isSavePending(getState())) {
                        dispatch(setSavePending(true));
                    }
                    dispatch(setTriggerActive(true));
                    dispatch(
                        processTrigger(
                            cappedValue,
                            getTriggerRecordingLength(getState()) * 1000, // ms to uS
                            (progressMessage, prog) => {
                                dispatch(
                                    setProgress({
                                        progressMessage,
                                        progress:
                                            prog && prog >= 0
                                                ? prog
                                                : undefined,
                                    })
                                );
                            }
                        )
                    ).then(() => {
                        if (!DataManager().hasPendingTriggers()) {
                            dispatch(clearProgress());
                        }
                        if (
                            samplingRunning &&
                            getState().app.trigger.type === 'Single'
                        ) {
                            dispatch(samplingStop());
                        }
                    });
                } else if (
                    getState().app.trigger.active &&
                    !validTriggerValue &&
                    getState().app.trigger.type === 'Continuous'
                ) {
                    dispatch(setTriggerActive(false));
                }
            } else if (!isSavePending(getState())) {
                dispatch(setSavePending(true));
            }

            const durationInMicroSeconds =
                convertTimeToSeconds(
                    getState().app.dataLogger.duration,
                    getState().app.dataLogger.durationUnit
                ) * microSecondsPerSecond;
            if (durationInMicroSeconds <= DataManager().getTimestamp(chan)) {
                if (samplingRunning) {
                    dispatch(samplingStop());
                }
            }
        };

        dispatch(
            updateCurrentDeviceAction({
                capabilities: {},
                portName: null,
                isRunning: false,
                isSmuMode: false,
            })
        );

        try {
            const deviceItem: MultiDeviceItem = {
                selector: sel,
                portName: deviceInfo.serialNumber,
                isSmuMode: true,
                deviceRunning: false,
            };

            // convert selector to channel
            channel = addDevice(deviceItem);

            device = new SerialDevice(deviceInfo, onSample, channel);

            dispatch(
                setSamplingAttrsAction({
                    maxContiniousSamplingTimeUs:
                        device.capabilities.maxContinuousSamplingTimeUs!,
                })
            );

            dispatch(
                setDeviceRunningAction({
                    isRunning: device.isRunningInitially,
                })
            );
            const metadata = device.parseMeta(await device.start());

            await device.ppkUpdateRegulator(metadata.vdd);
            dispatch(
                updateRegulatorAction({
                    vdd: metadata.vdd,
                    currentVDD: metadata.vdd,
                    ...device.vddRange,
                })
            );
            await dispatch(initGains());
            dispatch(updateSpikeFilter());
            const isSmuMode = metadata.mode === 2;
            // 1 = Ampere
            // 2 = SMU
            dispatch(setPowerModeAction({ isSmuMode }));

            if (!isSmuMode) {
                await device!.ppkDeviceRunning(1);
                logger.info('DUT ON');
                dispatch(setDeviceRunningAction({ isRunning: true }));
            }

            dispatch(clearFileLoadedAction());

            updateDevice(sel, {
                device,
                isSmuMode,
                deviceRunning: !isSmuMode,
                capabilities: device.capabilities,
                currentVdd: metadata.vdd,
            });
            dispatch(setCurrentSelector(sel));

            logger.info('PPK started', sel);
        } catch (err) {
            logger.error('Failed to start PPK', sel);
            logger.debug(err);
            dispatch({ type: 'device/deselectDevice' });
        }

        dispatch(
            deviceOpenedAction({
                portName: deviceInfo.serialNumber,
                capabilities: device!.capabilities,
            })
        );

        logger.info('PPK opened', sel);

        device!.on('error', (message, error) => {
            logger.error(message);
            if (error) {
                dispatch(close(sel));
                logger.debug(error);
            }
        });

        clearInterval(updateRequestInterval);
        let renderIndex: number;
        let lastRenderRequestTime = 0;
        updateRequestInterval = setInterval(() => {
            const now = Date.now();
            if (
                renderIndex !== DataManager().getTotalSavedRecords() &&
                getState().app.app.samplingRunning &&
                (isDataLoggerPane(getState()) ||
                    isMultiDevicePane(getState())) &&
                (DataManager().isInSync() ||
                    now - lastRenderRequestTime >= 1000) // force 1 FPS
            ) {
                const timestamp = now;
                // console.log(`${renderIndex}: ${now - lastRenderRequestTime}ms`);
                lastRenderRequestTime = now;
                if (getState().app.chart.liveMode) {
                    requestAnimationFrame(() => {
                        /*
                            requestAnimationFrame pauses when app is in the background.
                            If timestamp is more than 10ms ago, do not dispatch animationAction.
                        */
                        if (Date.now() - timestamp < 100) {
                            dispatch(animationAction());
                        }
                    });
                }

                requestAnimationFrame(() => {
                    /*
                        requestAnimationFrame pauses when app is in the background.
                        If timestamp is more than 10ms ago, do not dispatch animationAction.
                    */
                    if (Date.now() - timestamp < 100) {
                        dispatch(miniMapAnimationAction());
                    }
                });
                renderIndex = DataManager().getTotalSavedRecords();
            }
        }, Math.max(30, DataManager().getSamplingTime() / 1000));
    };

export const updateRegulator =
    (): AppThunk<RootState, Promise<void>> => async (dispatch, getState) => {
        const { vdd } = getState().app.voltageRegulator;
        await device!.ppkUpdateRegulator(vdd);
        logger.info(`Voltage regulator updated to ${vdd} mV`);
        dispatch(updateRegulatorAction({ currentVDD: vdd }));
        updateDeviceByChannel(channel!, { currentVdd: vdd });
    };

export const updateGains =
    (index: number): AppThunk<RootState, Promise<void>> =>
    async (_, getState) => {
        if (device!.ppkSetUserGains == null) {
            return;
        }
        const { gains } = getState().app;
        const gain = gains[index] / 100;
        await device!.ppkSetUserGains(index, gain);
        logger.info(`Gain multiplier #${index + 1} updated to ${gain}`);
    };

export const updateAllGains =
    (): AppThunk<RootState, Promise<void>> => async (_, getState) => {
        if (device!.ppkSetUserGains == null) {
            return;
        }
        const { gains } = getState().app;

        for (let i = 0; i < gains.length; i += 1) {
            // eslint-disable-next-line no-await-in-loop
            await device!.ppkSetUserGains(i, gains[i] / 100);
            logger.info(`Gain multiplier #${i + 1} updated to ${i}`);
        }
    };

export const setDeviceRunning =
    (isRunning: boolean): AppThunk<RootState, Promise<void>> =>
    async dispatch => {
        await device!.ppkDeviceRunning(isRunning ? 1 : 0);
        logger.info(`DUT ${isRunning ? 'ON' : 'OFF'}`);
        dispatch(setDeviceRunningAction({ isRunning }));
        updateDeviceByChannel(channel!, { deviceRunning: isRunning });
    };

export const setPowerMode =
    (isSmuMode: boolean): AppThunk<RootState, Promise<void>> =>
    async dispatch => {
        logger.info(`Mode: ${isSmuMode ? 'Source meter' : 'Ampere meter'}`);
        if (isSmuMode) {
            await dispatch(setDeviceRunning(false));
            await device!.ppkSetPowerMode(true); // set to source mode
            dispatch(setPowerModeAction({ isSmuMode: true }));
        } else {
            await device!.ppkSetPowerMode(false); // set to ampere mode
            dispatch(setPowerModeAction({ isSmuMode: false }));
            await dispatch(setDeviceRunning(true));
        }
        updateDeviceByChannel(channel!, { isSmuMode });
    };

let latestTrigger: Promise<unknown> | undefined;
let releaseLastSession: (() => void) | undefined;

export const processTrigger =
    (
        triggerValue: number,
        triggerLength: number,
        onProgress?: (message: string, progress?: number) => void
    ): AppThunk<RootState, Promise<void>> =>
    async (dispatch, getState) => {
        const trigger = DataManager().addTimeReachedTrigger(triggerLength);

        const triggerTime = Date.now();
        const remainingRecordingLength = triggerLength / 2;

        const updateDataCollection = () => {
            const delta = Date.now() - triggerTime;
            onProgress?.(
                `Triggered with ${unit(triggerValue, 'uA').format({
                    notation: 'fixed',
                    precision: 2,
                })}. Collecting data after trigger.`,
                Math.min(100, (delta / remainingRecordingLength) * 100)
            );
        };

        latestTrigger = trigger;
        const timeProgressUpdate = setInterval(() => {
            updateDataCollection();
        }, 500);

        trigger.finally(() => {
            clearInterval(timeProgressUpdate);
        });

        try {
            const info = await trigger;

            const numberOfBytes =
                info.bytesRange.end - info.bytesRange.start + 1;
            const buffer = Buffer.alloc(numberOfBytes);
            info.writeBuffer.readFromCachedData(
                buffer,
                info.bytesRange.start,
                info.bytesRange.end - info.bytesRange.start + 1
            );

            const recordingDuration = indexToTimestamp(
                numberOfBytes / frameSize
            );

            const createSessionData = DataManager().createSessionData;
            const session = await createSessionData(
                buffer,
                getSessionRootFolder(getState()),
                info.absoluteTime
            );

            dispatch(setTriggerOrigin(indexToTimestamp(info.triggerOrigin)));

            resetCache();
            latestTrigger = undefined;
            // Auto load triggered data
            await DataManager().loadSession(
                session.fileBuffer,
                session.foldingBuffer
            );
            dispatch(setLatestDataTimestamp(recordingDuration));
            dispatch(chartWindowAction(recordingDuration, recordingDuration));
            dispatch(triggerForceRerenderMainChart());
            dispatch(triggerForceRerenderMiniMap());
            dispatch(miniMapAnimationAction());

            if (session) {
                releaseLastSession?.();
                releaseLastSession = undefined;
                releaseLastSession = async () => {
                    try {
                        await session?.fileBuffer.close();
                        session?.fileBuffer.release();
                    } catch {
                        // do nothing
                    }
                };
            }
        } catch (e) {
            logger.debug(describeError(e));
        }
    };

export const switchCurrentDevice = (chan: number, dev: SerialDevice) => {
    channel = chan;
    device = dev;
};

export const getCurrentChannel = () => channel;
