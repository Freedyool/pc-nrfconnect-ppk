/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import type { RootState } from '.';

export interface SimulatorState {
    active: boolean;
}

const initialState = (): SimulatorState => ({
    active: false,
});

const simulatorSlice = createSlice({
    name: 'simulator',
    initialState: initialState(),
    reducers: {
        setSimulatorActive: (state, action: PayloadAction<boolean>) => {
            state.active = action.payload;
        },
    },
});

export const getSimulatorActive = (state: RootState) =>
    state.app.simulator.active;

export const { setSimulatorActive } = simulatorSlice.actions;

export default simulatorSlice.reducer;
