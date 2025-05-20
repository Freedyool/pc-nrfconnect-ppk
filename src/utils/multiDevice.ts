/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import { Capabilities } from '../device/abstractDevice';
import SerialDevice from '../device/serialDevice';

export interface MultiDeviceItem {
    selector: number;
    device: SerialDevice;
    portName: string | null | undefined;
    isSmuMode: boolean;
    deviceRunning: boolean;
    capabilities: Capabilities;
    currentVdd: number;
}

const multiDevices: MultiDeviceItem[] = [];

export const getDevice = (selector: number): MultiDeviceItem | null => {
    const deviceItem = multiDevices.find(d => d.selector === selector);
    if (deviceItem) {
        return deviceItem;
    }
    return null;
};

export const addDevice = (device: MultiDeviceItem) => {
    const existingDeviceIndex = multiDevices.findIndex(
        d => d.selector === device.selector
    );
    if (existingDeviceIndex !== -1) {
        multiDevices[existingDeviceIndex] = device;
    } else {
        multiDevices.push(device);
    }
};

export const removeDevice = (selector: number) => {
    const index = multiDevices.findIndex(d => d.selector === selector);
    if (index !== -1) {
        multiDevices.splice(index, 1);
    }
};

export const updateDevice = (
    selector: number,
    params: Partial<MultiDeviceItem>
) => {
    const existingDeviceIndex = multiDevices.findIndex(
        d => d.selector === selector
    );
    if (existingDeviceIndex !== -1) {
        multiDevices[existingDeviceIndex] = {
            ...multiDevices[existingDeviceIndex],
            ...params,
        };
    }
};

export const getDeviceCount = () => multiDevices.length;
export const getAllDevice = () => multiDevices.map(d => d.device);
