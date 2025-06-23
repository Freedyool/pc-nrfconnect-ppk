/*
 * Copyright (c) 2025 Nordic Semiconductor ASA
 *
 * SPDX-License-Identifier: LicenseRef-Nordic-4-Clause
 */

import { RemoteCapture } from './remoteCapture';

function getTimestamp(): string {
    return new Date().toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
    });
}

function log(level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: any) {
    const timestamp = getTimestamp();
    const prefix = `[${timestamp}] [${level}]`;

    if (data !== undefined) {
        console.log(`${prefix} ${message}`, data);
    } else {
        console.log(`${prefix} ${message}`);
    }
}

function getWebSocketStateDesc(state: number): string {
    const states = {
        0: 'CONNECTING (连接中)',
        1: 'OPEN (已打开)',
        2: 'CLOSING (关闭中)',
        3: 'CLOSED (已关闭)',
    };
    return states[state as keyof typeof states] || `UNKNOWN (${state})`;
}

async function exampleUsage() {
    console.log('='.repeat(60));
    log('INFO', 'RemoteCapture 测试程序启动');
    console.log('='.repeat(60));

    // 创建RemoteCapture实例
    const remoteCapture = new RemoteCapture('wss://echo.websocket.org');

    // 监听事件
    remoteCapture.on('opening', url => {
        log('INFO', `正在连接到服务器: ${url}`);
    });

    remoteCapture.on('connected', url => {
        log('INFO', `✓ 成功连接到服务器: ${url}`);
    });

    remoteCapture.on('data', data => {
        log('INFO', `📥 收到服务器数据: ${data.toString()}`);
    });

    remoteCapture.on('stateChange', state => {
        log('INFO', `🔄 WebSocket状态变化: ${getWebSocketStateDesc(state)}`);
    });

    remoteCapture.on('error', error => {
        log('ERROR', `❌ 连接错误: ${error.message || error}`);
    });

    remoteCapture.on('disconnect', code => {
        log('WARN', `🔌 连接已断开 (退出码: ${code})`);
    });
    try {
        // 启动连接
        log('INFO', '🚀 正在启动 RemoteCapture...');
        await remoteCapture.start();
        log('INFO', '✅ RemoteCapture 启动成功');

        // 发送测试数据
        setTimeout(() => {
            console.log('-'.repeat(40));
            log('INFO', '📤 准备发送测试数据...');

            const testData = {
                type: 'test',
                message: 'Hello from RemoteCapture!',
                timestamp: Date.now(),
            };

            if (remoteCapture.send(testData)) {
                log('INFO', '✓ 测试数据发送成功', testData);
            } else {
                log('WARN', '✗ 测试数据发送失败');
            }
        }, 2000);

        // 5秒后关闭连接
        setTimeout(() => {
            console.log('-'.repeat(40));
            log('INFO', '🔄 准备关闭连接...');
            remoteCapture.stop();

            setTimeout(() => {
                console.log('='.repeat(60));
                log('INFO', '🏁 测试程序结束');
                console.log('='.repeat(60));
            }, 1000);
        }, 5000);
    } catch (error) {
        log('ERROR', '❌ 启动 RemoteCapture 失败:', error);
    }
}

// 运行示例（如果直接执行此文件）
if (require.main === module) {
    exampleUsage().catch(console.error);
}

export { exampleUsage };
