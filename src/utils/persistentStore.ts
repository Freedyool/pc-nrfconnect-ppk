/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import {
    getAppDataDir,
    getPersistentStore,
} from '@nordicsemiconductor/pc-nrfconnect-shared';

const LAST_SAVE_DIR = 'lastSaveDir';
const SPIKE_FILTER_SAMPLES = 'spikeFilter.samples';
const SPIKE_FILTER_ALPHA = 'spikeFilter.alpha';
const SPIKE_FILTER_ALPHA5 = 'spikeFilter.alpha5';
const DIGITAL_CHANNELS_VISIBLE = 'digitalChannelsVisible';
const DIGITAL_CHANNELS = 'digitalChannels';
const TIMESTAMPS_VISIBLE = 'timestampsVisible';
const VOLTAGE_REGULATOR_MAX_CAP_PPK1 = 'voltageRegulatorMaxCapPPK1';
const VOLTAGE_REGULATOR_MAX_CAP_PPK2 = 'voltageRegulatorMaxCap';

const store = getPersistentStore<StoreSchema>({
    migrations: {
        '4.0.0': instance => {
            instance.set(VOLTAGE_REGULATOR_MAX_CAP_PPK2, 5000);
        },
    },
});

type SAMPLE_FREQUENCY = `sampleFreq-${number}`;
type DURATION_SECONDS = `durationSeconds-${number}`;

export interface SpikeFilter {
    samples: number;
    alpha: number;
    alpha5: number;
}

export type booleanTupleOf8 = [
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean,
    boolean
];

export type TimeUnit = 's' | 'm' | 'h' | 'd';

interface StoreSchema {
    [LAST_SAVE_DIR]: string;
    [SPIKE_FILTER_SAMPLES]: number;
    [SPIKE_FILTER_ALPHA]: number;
    [SPIKE_FILTER_ALPHA5]: number;

    [DIGITAL_CHANNELS_VISIBLE]: boolean;
    [DIGITAL_CHANNELS]: booleanTupleOf8;
    [TIMESTAMPS_VISIBLE]: boolean;

    [VOLTAGE_REGULATOR_MAX_CAP_PPK2]: number;

    [maxSampleFrequency: SAMPLE_FREQUENCY]: number;
    [maxSampleFrequency: DURATION_SECONDS]: number;
}

export const getLastSaveDir = () => store.get(LAST_SAVE_DIR, getAppDataDir());
export const setLastSaveDir = (dir: string) => store.set('lastSaveDir', dir);

export const getSpikeFilter = (defaults: SpikeFilter): SpikeFilter => ({
    samples: store.get('spikeFilter.samples', defaults.samples),
    alpha: store.get('spikeFilter.alpha', defaults.alpha),
    alpha5: store.get('spikeFilter.alpha5', defaults.alpha5),
});
export const setSpikeFilter = ({ samples, alpha, alpha5 }: SpikeFilter) => {
    store.set('spikeFilter.samples', samples);
    store.set('spikeFilter.alpha', alpha);
    store.set('spikeFilter.alpha5', alpha5);
};

export const getDigitalChannels = () =>
    store.get(DIGITAL_CHANNELS, [
        true,
        true,
        false,
        false,
        false,
        false,
        false,
        false,
    ]);
export const setDigitalChannels = (digitalChannels: booleanTupleOf8) =>
    store.set(DIGITAL_CHANNELS, digitalChannels);

export const getDigitalChannelsVisible = () =>
    store.get(DIGITAL_CHANNELS_VISIBLE, true);
export const setDigitalChannelsVisible = (digitalChannelsVisible: boolean) =>
    store.set(DIGITAL_CHANNELS_VISIBLE, digitalChannelsVisible);

export const getTimestampsVisible = () => store.get(TIMESTAMPS_VISIBLE, false);
export const setTimestampsVisible = (timestampsVisible: boolean) =>
    store.set(TIMESTAMPS_VISIBLE, timestampsVisible);

export const getSampleFreq = (maxSampleFreq: number) =>
    store.get(`sampleFreq-${maxSampleFreq}`, maxSampleFreq);
export const setSampleFreq = (maxSampleFreq: number, sampleFreq: number) =>
    store.set(`sampleFreq-${maxSampleFreq}`, sampleFreq);

export const getDuration = (maxSampleFreq: number, defaultValue: number) =>
    store.get(`duration-${maxSampleFreq}`, defaultValue);
export const setDuration = (maxSampleFreq: number, duration: number) => {
    store.set(`duration-${maxSampleFreq}`, duration);
};

export const getPreferredSessionLocation = (defaultValue: string) =>
    store.get(`session-root-folder`, defaultValue);
export const setPreferredSessionLocation = (path: string) => {
    store.set(`session-root-folder`, path);
};

export const getDurationUnit = (
    maxSampleFreq: number,
    defaultValue: TimeUnit
) => store.get(`durationUnit-${maxSampleFreq}`, defaultValue);
export const setDurationUnit = (maxSampleFreq: number, timeUnit: TimeUnit) => {
    store.set(`durationUnit-${maxSampleFreq}`, timeUnit);
};

export const getAutoStopSampling = (defaultValue: boolean) =>
    store.get(`autoStopSampling`, defaultValue);
export const setAutoStopSampling = (autoStop: boolean) =>
    store.set(`autoStopSampling`, autoStop);
export const getVoltageRegulatorMaxCapPPK1 = (defaultMaxCap: number) =>
    store.get(VOLTAGE_REGULATOR_MAX_CAP_PPK1, defaultMaxCap);
export const setVoltageRegulatorMaxCapPPK1 = (maxCap: number) =>
    store.set(VOLTAGE_REGULATOR_MAX_CAP_PPK1, maxCap);
export const getVoltageRegulatorMaxCapPPK2 = (defaultMaxCap: number) =>
    store.get(VOLTAGE_REGULATOR_MAX_CAP_PPK2, defaultMaxCap);
export const setVoltageRegulatorMaxCapPPK2 = (maxCap: number) =>
    store.set(VOLTAGE_REGULATOR_MAX_CAP_PPK2, maxCap);
