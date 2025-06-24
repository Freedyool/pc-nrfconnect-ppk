/*
 * Copyright (c) 2015 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Group } from '@nordicsemiconductor/pc-nrfconnect-shared';

import { RemoteCapture as RemoteCaptureService } from '../../remote/remoteCapture';
import {
    getRemoteConnectionError,
    // Remote capture selectors and actions
    getRemoteUrl,
    isRemoteConnected,
    isRemoteConnecting,
    setRemoteConnected,
    setRemoteConnecting,
    setRemoteConnectionError,
    setRemoteUrl,
} from '../../slices/appSlice';

// 添加自定义动画样式
const customStyles = `
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
  
  @keyframes slideInFromTop {
    0% {
      opacity: 0;
      transform: translateY(-10px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .animate-shimmer {
    animation: shimmer 1.5s infinite;
  }
  
  .animate-slide-in {
    animation: slideInFromTop 0.3s ease-out;
  }
`;

// 注入样式到页面
if (typeof document !== 'undefined') {
    const styleElement = document.createElement('style');
    styleElement.textContent = customStyles;
    if (!document.head.querySelector('style[data-remote-capture]')) {
        styleElement.setAttribute('data-remote-capture', 'true');
        document.head.appendChild(styleElement);
    }
}

export default () => {
    const dispatch = useDispatch();

    // Remote capture state
    const remoteUrl = useSelector(getRemoteUrl);
    const connected = useSelector(isRemoteConnected);
    const connecting = useSelector(isRemoteConnecting);
    const connectionError = useSelector(getRemoteConnectionError);
    // Local state
    const [localUrl, setLocalUrl] = useState(remoteUrl);
    const [remoteService, setRemoteService] =
        useState<RemoteCaptureService | null>(null);
    const [justConnected, setJustConnected] = useState(false);

    // Helper functions for conditional styling and text
    const getStatusIndicatorClass = () => {
        if (connected) return 'tw-bg-green-500';
        if (connecting) return 'tw-bg-yellow-500';
        return 'tw-bg-gray-400';
    };

    const getStatusTextClass = () => {
        if (connected) return 'tw-text-green-700';
        if (connecting) return 'tw-text-yellow-700';
        return 'tw-text-gray-600';
    };

    const getStatusText = () => {
        if (connected) return 'Connected';
        if (connecting) return 'Connecting...';
        return 'Disconnected';
    };

    // Update local URL when Redux state changes
    useEffect(() => {
        setLocalUrl(remoteUrl);
    }, [remoteUrl]);

    // 连接成功时显示短暂的成功提示
    useEffect(() => {
        if (connected && !connecting) {
            setJustConnected(true);
            const timer = setTimeout(() => {
                setJustConnected(false);
            }, 2000); // 2秒后隐藏成功提示

            return () => clearTimeout(timer);
        }
    }, [connected, connecting]); // Handle connection

    const handleConnect = async () => {
        if (connecting || connected) {
            console.warn('RemoteCapture: 已在连接中或已连接，忽略连接请求');
            return;
        }
        console.log(`RemoteCapture: 开始连接到 ${localUrl}`);

        try {
            setJustConnected(false); // 重置成功状态
            dispatch(setRemoteConnecting(true));
            dispatch(setRemoteConnectionError(undefined)); // 清除之前的错误
            dispatch(setRemoteUrl(localUrl));

            const service = new RemoteCaptureService(localUrl);

            // Set up event listeners
            service.on('connected', () => {
                console.log('RemoteCapture: 连接事件触发');
                dispatch(setRemoteConnected(true));
            });

            service.on('error', (error: Error) => {
                console.error('RemoteCapture: 错误事件触发:', error);
                dispatch(setRemoteConnectionError(error.message));
            });

            service.on('disconnect', code => {
                console.log(`RemoteCapture: 断连事件触发，代码: ${code}`);
                dispatch(setRemoteConnected(false));
                // 不要在这里重置 connecting 状态，因为可能是主动断开
            });

            service.on('data', (data: Buffer) => {
                console.log(
                    'RemoteCapture: 收到数据:',
                    data.toString().slice(0, 100)
                );
                // TODO: Process received data
            });

            console.log('RemoteCapture: 开始启动服务...');
            await service.start();
            console.log('RemoteCapture: 服务启动完成');

            // 发送测试数据
            setTimeout(() => {
                const testData = {
                    type: 'test',
                    message: 'Hello from RemoteCapture!',
                    timestamp: Date.now(),
                };
                if (service.send(testData)) {
                    console.log('RemoteCapture: 测试数据发送成功', testData);
                } else {
                    console.log('RemoteCapture: 测试数据发送失败');
                }
            }, 2000);
            setRemoteService(service);
        } catch (error) {
            console.error('RemoteCapture: 连接失败:', error);
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            dispatch(setRemoteConnectionError(errorMessage));
            dispatch(setRemoteConnecting(false)); // 确保重置连接状态
        }
    }; // Handle disconnect
    const handleDisconnect = () => {
        console.log('RemoteCapture: 用户请求断开连接');

        if (remoteService) {
            try {
                remoteService.stop();
                setRemoteService(null);
                console.log('RemoteCapture: 服务已停止');
            } catch (error) {
                console.warn('RemoteCapture: 停止服务时出错:', error);
            }
        }

        // 立即重置UI状态
        dispatch(setRemoteConnected(false));
        dispatch(setRemoteConnecting(false));
        dispatch(setRemoteConnectionError(undefined)); // 清除错误信息
    };

    // Cleanup on unmount
    useEffect(
        () => () => {
            if (remoteService) {
                remoteService.stop();
            }
        },
        [remoteService]
    );

    return (
        <Group heading="Remote Capture" collapsible gap={4}>
            {/* Remote Connection Section */}
            <div className="tw-flex tw-flex-col tw-gap-3">
                <div className="tw-flex tw-flex-col tw-gap-2">
                    <span className="tw-text-sm tw-font-medium">
                        WebSocket URL
                    </span>
                    <input
                        type="text"
                        value={localUrl}
                        onChange={e => setLocalUrl(e.target.value)}
                        placeholder="wss://your-server.com"
                        disabled={connecting || connected}
                        className="focus:tw-ring-blue-500 focus:tw-border-transparent tw-w-full tw-rounded-md tw-border tw-border-gray-300 tw-px-3 
                                 tw-py-2 tw-text-sm focus:tw-outline-none focus:tw-ring-2
                                 disabled:tw-cursor-not-allowed disabled:tw-bg-gray-100"
                    />
                </div>{' '}
                <div className="tw-flex tw-gap-2">
                    {!connected ? (
                        <Button
                            className={`tw-relative tw-flex-1 tw-transition-all tw-duration-300 ${
                                connecting
                                    ? 'tw-bg-blue-600 tw-border-blue-600'
                                    : ''
                            }`}
                            variant="primary"
                            onClick={handleConnect}
                            disabled={connecting || !localUrl.trim()}
                        >
                            <div className="tw-flex tw-items-center tw-justify-center tw-gap-2">
                                {connecting && (
                                    <div className="tw-border-t-transparent tw-h-4 tw-w-4 tw-animate-spin tw-rounded-full tw-border-2 tw-border-white" />
                                )}
                                <span>
                                    {connecting ? 'Connecting...' : 'Connect'}
                                </span>
                            </div>
                        </Button>
                    ) : (
                        <Button
                            className="tw-flex-1 tw-transition-all tw-duration-300"
                            variant="secondary"
                            onClick={handleDisconnect}
                        >
                            Disconnect
                        </Button>
                    )}
                </div>{' '}
                {/* Connection Status */}
                <div className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-transition-all tw-duration-300">
                    <div
                        className={`tw-relative tw-h-3 tw-w-3 tw-rounded-full tw-transition-all tw-duration-500 ${getStatusIndicatorClass()}`}
                    >
                        {/* 连接中的脉动效果 */}
                        {connecting && (
                            <div className="tw-bg-yellow-500 tw-absolute tw-inset-0 tw-animate-ping tw-rounded-full tw-opacity-75" />
                        )}
                        {/* 连接成功的闪烁效果 */}
                        {connected && (
                            <div className="tw-absolute tw-inset-0 tw-animate-pulse tw-rounded-full tw-bg-green-500" />
                        )}{' '}
                    </div>
                    <span
                        className={`tw-font-medium tw-transition-colors tw-duration-300 ${getStatusTextClass()}`}
                    >
                        {getStatusText()}
                    </span>

                    {/* 连接进度条 */}
                    {connecting && (
                        <div className="tw-ml-2 tw-flex-1">
                            {' '}
                            <div className="tw-h-1.5 tw-w-full tw-overflow-hidden tw-rounded-full tw-bg-gray-200">
                                <div className="tw-from-blue-400 tw-to-blue-600 tw-relative tw-h-full tw-animate-pulse tw-rounded-full tw-bg-gradient-to-r">
                                    {/* 移动的光泽效果 */}
                                    <div className="tw-from-transparent tw-to-transparent animate-shimmer tw-absolute tw-left-0 tw-top-0 tw-h-full tw-w-full tw-bg-gradient-to-r tw-via-white tw-opacity-30" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                {/* 连接成功提示 */}
                {justConnected && (
                    <div className="animate-slide-in tw-rounded-md tw-border tw-border-green-200 tw-bg-green-50 tw-p-3 tw-transition-all tw-duration-300">
                        <div className="tw-flex tw-items-center tw-gap-2">
                            {/* 成功图标 */}
                            <div className="tw-h-4 tw-w-4 tw-flex-shrink-0">
                                <svg
                                    className="tw-h-full tw-w-full tw-text-green-500"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </div>
                            <div className="tw-text-sm tw-font-medium tw-text-green-800">
                                Successfully connected to WebSocket!
                            </div>
                        </div>
                    </div>
                )}
                {/* Connection Error */}
                {connectionError && (
                    <div className="animate-slide-in tw-rounded-md tw-border tw-border-red-200 tw-bg-red-50 tw-p-3 tw-transition-all tw-duration-300">
                        <div className="tw-flex tw-items-start tw-gap-2">
                            {/* 错误图标 */}
                            <div className="tw-mt-0.5 tw-h-4 tw-w-4 tw-flex-shrink-0">
                                <svg
                                    className="tw-h-full tw-w-full tw-text-red-500"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                >
                                    <path
                                        fillRule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                        clipRule="evenodd"
                                    />
                                </svg>
                            </div>
                            <div className="tw-text-sm tw-text-red-800">
                                <strong>Connection Error:</strong>{' '}
                                {connectionError}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Group>
    );
};
