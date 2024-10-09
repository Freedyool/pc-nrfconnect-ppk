/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import { currentPane } from '@nordicsemiconductor/pc-nrfconnect-shared';

import type { RootState } from '../slices';

export enum Panes {
    DATA_LOGGER = 'Data Logger',
    SCOPE = 'Scope',
    SIMULATOR = 'Simulator',
}

export const isScopePane = (state: RootState) =>
    currentPane(state) === Panes.SCOPE;
export const isDataLoggerPane = (state: RootState) =>
    currentPane(state) === Panes.DATA_LOGGER;
export const isSimulatorPane = (state: RootState) =>
    currentPane(state) === Panes.SIMULATOR;

export const getState = (state: RootState) => state;
