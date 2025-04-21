/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { Capabilities } from '../device/abstractDevice';
import type { RootState } from '.';

export interface DeviceItem {
    selector: number;
    portName: string | null | undefined;
    isSmuMode: boolean;
    deviceRunning: boolean;
    capabilities: Capabilities;
}

export interface MultiDeviceState {
    deviceSelectorList: string[];
    devices: DeviceItem[];
    deviceSelected: number;
}

const initialState = (): MultiDeviceState => ({
    // deviceSelectorList: ["SELECT DEVICE"],
    deviceSelectorList: ['DEVICE1', 'DEVICE2'],
    devices: [],
    deviceSelected: 0,
});

const updateMultiDevice = (
    state: MultiDeviceState,
    updateToMergeIn: Partial<DeviceItem>,
    index: number
) => {
    const device = state.devices[index];
    if (device) {
        Object.assign(device, updateToMergeIn);
    }
};

const multiDeviceSlice = createSlice({
    name: 'multiDevice',
    initialState: initialState(),
    reducers: {
        updateDevice: (state, action: PayloadAction<DeviceItem>) => {
            const index = state.devices.findIndex(
                item =>
                    item.selector === action.payload.selector ||
                    item.portName === action.payload.portName
            );
            if (index !== -1) {
                if (action.payload.selector === -1) {
                    updateMultiDevice(
                        state,
                        {
                            isSmuMode: action.payload.isSmuMode,
                            deviceRunning: action.payload.deviceRunning,
                            capabilities: action.payload.capabilities,
                        },
                        index
                    );
                } else {
                    state.devices[index] = action.payload;
                }
            } else {
                state.devices.push(action.payload);
            }
        },
        removeDevice: (state, action: PayloadAction<number>) => {
            const index = state.devices.findIndex(
                d => d.selector === action.payload
            );
            if (index !== -1) {
                state.devices.splice(index, 1);
                if (state.deviceSelected === action.payload) {
                    state.deviceSelected = state.devices[0]?.selector ?? 0;
                }
            }
        },
        setDeviceSelectorList: (state, action: PayloadAction<string[]>) => {
            state.deviceSelectorList = action.payload;
        },
        setSelectedDevice: (state, action: PayloadAction<number>) => {
            state.deviceSelected = action.payload;
        },
        setPowerModeAction: (
            state,
            action: PayloadAction<{ isSmuMode: boolean }>
        ) => {
            updateMultiDevice(
                state,
                {
                    isSmuMode: action.payload.isSmuMode,
                },
                state.deviceSelected
            );
        },
        setDeviceRunningAction: (
            state,
            action: PayloadAction<{ isRunning: boolean }>
        ) => {
            updateMultiDevice(
                state,
                {
                    deviceRunning: action.payload.isRunning,
                },
                state.deviceSelected
            );
        },
    },
});

export const multiDeviceState = (state: RootState) => state.app.multiDevice;
export const getMultiDevices = (state: RootState) =>
    state.app.multiDevice.devices;
export const getSelectedDevice = (state: RootState) =>
    state.app.multiDevice.devices.find(
        d => d.selector === state.app.multiDevice.deviceSelected
    );
export const getSelectedDeviceIndex = (state: RootState) =>
    state.app.multiDevice.deviceSelected;
export const getDeviceSelectorList = (state: RootState) =>
    state.app.multiDevice.deviceSelectorList;

export const {
    updateDevice,
    removeDevice,
    setDeviceSelectorList,
    setSelectedDevice,
    setPowerModeAction,
    setDeviceRunningAction,
} = multiDeviceSlice.actions;

export default multiDeviceSlice.reducer;
