/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import type { RootState } from '.';

export interface MultiDeviceState {
    deviceSelectorList: string[];
    currentSelector: number;
    sampleOffset: number;
}

const initialState = (): MultiDeviceState => ({
    deviceSelectorList: ['DEVICE1', 'DEVICE2'],
    currentSelector: 0,
    sampleOffset: 0,
});

const multiDeviceSlice = createSlice({
    name: 'multiDevice',
    initialState: initialState(),
    reducers: {
        setDeviceSelectorList: (state, action: PayloadAction<string[]>) => {
            state.deviceSelectorList = action.payload;
        },
        setCurrentSelector: (state, action: PayloadAction<number>) => {
            state.currentSelector = action.payload;
        },
        setSampleOffset: (state, action: PayloadAction<number>) => {
            state.sampleOffset = action.payload;
        },
    },
});

export const multiDeviceState = (state: RootState) => state.app.multiDevice;
export const getCurrentSelector = (state: RootState) =>
    state.app.multiDevice.currentSelector;
export const getDeviceSelectorList = (state: RootState) =>
    state.app.multiDevice.deviceSelectorList;
export const getSampleOffset = (state: RootState) =>
    state.app.multiDevice.sampleOffset;

export const { setDeviceSelectorList, setCurrentSelector, setSampleOffset } =
    multiDeviceSlice.actions;

export default multiDeviceSlice.reducer;
