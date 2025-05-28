/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import { colors } from '@nordicsemiconductor/pc-nrfconnect-shared';

import { Capabilities } from '../device/abstractDevice';
import SerialDevice from '../device/serialDevice';

export interface MultiDeviceItem {
    selector: number;
    portName: string | null | undefined;
    device?: SerialDevice;
    isSmuMode: boolean;
    deviceRunning: boolean;
    capabilities?: Capabilities;
    currentVdd?: number;
}

const multiDevices: MultiDeviceItem[] = [];
const multiColors = [colors.nordicBlue, colors.red, colors.green];

export const getDevice = (
    selector: number
): { device: MultiDeviceItem; channel: number } | null => {
    const channel = multiDevices.findIndex(d => d.selector === selector);
    if (channel !== -1) {
        return { device: multiDevices[channel], channel };
    }
    return null;
};

export const addDevice = (device: MultiDeviceItem): number => {
    const existingDeviceIndex = multiDevices.findIndex(
        d => d.selector === device.selector
    );
    if (existingDeviceIndex !== -1) {
        multiDevices[existingDeviceIndex] = device;
    } else {
        return multiDevices.push(device) - 1;
    }
    return existingDeviceIndex;
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

export const updateDeviceByChannel = (
    channel: number,
    params: Partial<MultiDeviceItem>
) => {
    if (multiDevices[channel] === undefined) return;
    multiDevices[channel] = {
        ...multiDevices[channel],
        ...params,
    };
};

export const getDeviceCount = () =>
    multiDevices.filter(d => d.portName !== undefined).length;
export const getAllDevice = () => multiDevices.map(d => d.device);
export const getAllDeviceName = () => multiDevices.map(d => d.portName);
export const getColor = (chan: number) => multiColors[chan] ?? colors.primary;
