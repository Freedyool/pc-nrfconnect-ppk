/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import type { RootState } from '.';

export interface MultiDeviceState {
    deviceSelectorList: string[];
    deviceConnectedCount: number;
    deviceSelected: number;
}

const initialState = (): MultiDeviceState => ({
    // deviceSelectorList: ["SELECT DEVICE"],
    deviceSelectorList: ['DEVICE1', 'DEVICE2'],
    deviceConnectedCount: 0,
    deviceSelected: 0,
});

const multiDeviceSlice = createSlice({
    name: 'multiDevice',
    initialState: initialState(),
    reducers: {
        setDeviceSelectorList: (state, action: PayloadAction<string[]>) => {
            state.deviceSelectorList = action.payload;
        },
        setSelectedDevice: (state, action: PayloadAction<number>) => {
            state.deviceSelected = action.payload;
        },
        addDeviceCount: state => {
            state.deviceConnectedCount += 1;
        },
        reduceDeviceCount: state => {
            state.deviceConnectedCount -= 1;
        },
    },
});

export const multiDeviceState = (state: RootState) => state.app.multiDevice;
export const getSelectedDeviceIndex = (state: RootState) =>
    state.app.multiDevice.deviceSelected;
export const getDeviceSelectorList = (state: RootState) =>
    state.app.multiDevice.deviceSelectorList;
export const getDeviceConnectedCount = (state: RootState) =>
    state.app.multiDevice.deviceConnectedCount;

export const {
    setDeviceSelectorList,
    addDeviceCount,
    reduceDeviceCount,
    setSelectedDevice,
} = multiDeviceSlice.actions;

export default multiDeviceSlice.reducer;
