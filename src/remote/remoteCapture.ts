/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import { getAppDir } from '@nordicsemiconductor/pc-nrfconnect-shared';
import { ChildProcess, fork } from 'child_process';
import EventEmitter from 'events';
import path from 'path';

interface RemoteCaptureMessage {
    opening?: string;
    started?: string;
    error?: string;
    state?: number;
    data?: Buffer;
}

interface WorkerMessage {
    open?: string;
    write?: any;
    close?: boolean;
}

export class RemoteCapture extends EventEmitter {
    private worker: ChildProcess | null = null;
    private url: string;
    private isConnected = false;

    constructor(url: string) {
        super();
        this.url = url;
    }

    start(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // 如果已经有连接，先清理
                if (this.worker) {
                    console.warn('RemoteCapture: 已存在活跃连接，先关闭...');
                    this.stop();
                }

                // 启动worker线程
                this.worker = fork(
                    path.resolve(getAppDir(), 'worker', 'remoteCapture.js')
                );
                // this.worker = fork(path.resolve('worker', 'remoteCapture.js'));

                // 设置超时
                const connectionTimeout = setTimeout(() => {
                    this.emit('error', new Error('连接超时 (30秒)'));
                    reject(new Error('连接超时'));
                }, 30000);

                // 监听worker消息
                this.worker.on('message', (message: RemoteCaptureMessage) => {
                    this.handleWorkerMessage(message);
                });

                // 监听worker进程关闭
                this.worker.on('close', (code, signal) => {
                    console.log(
                        `RemoteCapture worker 进程退出，代码: ${code}, 信号: ${signal}`
                    );
                    this.isConnected = false;
                    this.worker = null;
                    this.emit('disconnect', { code, signal });
                });

                // 监听worker进程错误
                this.worker.on('error', error => {
                    console.error('RemoteCapture worker 进程错误:', error);
                    clearTimeout(connectionTimeout);
                    this.isConnected = false;
                    this.worker = null;
                    this.emit('error', error);
                    reject(error);
                });

                // 发送连接命令
                console.log(`RemoteCapture: 发送连接命令到 ${this.url}`);
                this.worker.send({ open: this.url } as WorkerMessage);

                // 等待连接建立
                this.once('connected', () => {
                    clearTimeout(connectionTimeout);
                    this.isConnected = true;
                    console.log('RemoteCapture: 连接成功建立');
                    resolve();
                });

                this.once('error', error => {
                    clearTimeout(connectionTimeout);
                    console.error('RemoteCapture: 连接过程中发生错误:', error);
                    reject(error);
                });
            } catch (error) {
                console.error('RemoteCapture: 启动过程中发生异常:', error);
                reject(error);
            }
        });
    }

    stop(): void {
        if (this.worker) {
            console.log('RemoteCapture: 开始停止worker进程');

            const worker = this.worker;
            this.worker = null; // 立即清空引用，防止重复调用
            this.isConnected = false;

            // 设置超时，确保worker进程能及时退出
            const killTimeout = setTimeout(() => {
                if (worker && !worker.killed) {
                    console.log('RemoteCapture: 强制终止worker进程');
                    try {
                        worker.kill('SIGTERM');
                    } catch (error) {
                        console.warn('RemoteCapture: 强制终止时出错:', error);
                    }
                }
            }, 3000);

            // 监听退出事件
            worker.once('exit', code => {
                clearTimeout(killTimeout);
                console.log(`RemoteCapture: worker进程已退出，代码: ${code}`);
            });

            // 监听错误事件，防止未处理的错误
            worker.once('error', error => {
                clearTimeout(killTimeout);
                console.warn('RemoteCapture: worker退出时出错:', error);
            });

            try {
                // 检查连接状态并发送关闭命令
                if (worker.connected) {
                    console.log('RemoteCapture: 发送关闭命令');
                    worker.send({ close: true } as WorkerMessage);

                    // 给worker一些时间处理关闭命令，然后断开连接
                    setTimeout(() => {
                        try {
                            if (worker.connected) {
                                console.log('RemoteCapture: 断开IPC连接');
                                worker.disconnect();
                            }
                        } catch (error) {
                            console.warn(
                                'RemoteCapture: 断开连接时出错:',
                                error
                            );
                        }
                    }, 1000);
                } else {
                    console.log('RemoteCapture: Worker已断开连接，直接清理');
                }
            } catch (error) {
                console.warn('RemoteCapture: 停止过程中出错:', error);
                // 如果发送失败，尝试直接终止
                try {
                    if (!worker.killed) {
                        worker.kill('SIGTERM');
                    }
                } catch (killError) {
                    console.warn('RemoteCapture: 终止worker失败:', killError);
                }
            }
        } else {
            console.log('RemoteCapture: 没有活跃的worker进程需要停止');
        }
    }

    send(data: any): boolean {
        if (!this.worker || !this.isConnected) {
            console.warn('Remote capture is not connected');
            return false;
        }

        try {
            // 检查worker是否仍然连接
            if (!this.worker.connected) {
                console.warn('Worker IPC channel is disconnected');
                this.isConnected = false;
                return false;
            }

            this.worker.send({ write: data } as WorkerMessage);
            return true;
        } catch (error) {
            console.error('RemoteCapture: 发送数据时出错:', error);
            this.emit('error', error);
            return false;
        }
    }

    isConnectionActive(): boolean {
        return this.isConnected && this.worker !== null;
    }

    private handleWorkerMessage(message: RemoteCaptureMessage): void {
        if (message.opening) {
            this.emit('opening', message.opening);
            console.log(`Opening connection to: ${message.opening}`);
        }

        if (message.started) {
            this.emit('connected', message.started);
            console.log(`Connected to: ${message.started}`);
        }

        if (message.error) {
            this.emit('error', new Error(message.error));
            console.error(`Remote capture error: ${message.error}`);
        }

        if (message.state !== undefined) {
            this.emit('stateChange', message.state);
            console.log(
                `WebSocket state: ${RemoteCapture.getWebSocketStateString(
                    message.state
                )}`
            );
        }

        if (message.data) {
            this.emit('data', message.data);
        }
    }

    static getWebSocketStateString(state: number): string {
        switch (state) {
            case 0:
                return 'CONNECTING';
            case 1:
                return 'OPEN';
            case 2:
                return 'CLOSING';
            case 3:
                return 'CLOSED';
            default:
                return 'UNKNOWN';
        }
    }
}

export default RemoteCapture;
