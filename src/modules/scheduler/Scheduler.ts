/**
 *  Contains super classes and interfaces to perform tasks
 *  for a predetermined time.
 *
 *  Copyright:
 *      Copyright (c) 2022 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */

import * as cron from "node-cron";

/**
 * An interface to perform tasks for a predetermined time.
 */
export interface IScheduler {
    /**
     * Start a task
     */
    start(): void;

    /**
     * Stop a task
     */
    stop(): void;

    /**
     * If the work is running, return true
     */
    isRunning(): boolean;

    /**
     * If the work is running, return true
     */
    isWorking(): boolean;

    /**
     * Enter the option needed to perform the task
     * @param options The option needed to perform the task
     */
    setOption(options: any): void;

    /**
     * 스케줄러의 진행중인 작업이 완전히 종료될 때 까지 대기한다.
     * @param timeout Timeout milli seconds
     */
    waitForStop(timeout?: number): Promise<boolean>;
}

/**
 * 스케줄러의 실행상태에 대한 정의
 */
export enum ScheduleState {
    NONE = 0,
    STARTING = 2,
    RUNNING = 3,
    STOPPING = 4,
    STOPPED = 5,
}

/**
 * A class to perform tasks for a predetermined time.
 */
export class Scheduler implements IScheduler {
    /**
     * Cron 스케줄러 태스크의 객체
     */
    protected task: cron.ScheduledTask | null = null;

    /**
     * 스케줄러의 실행상태
     * @protected
     */
    protected state: ScheduleState;

    /**
     * The period in which the task is performed (in seconds).
     */
    protected interval: number;

    /**
     * If the work is running, return true
     */
    private is_working: boolean = false;

    /**
     * Constructor
     * @param interval The period in which the task is performed (in seconds).
     */
    constructor(interval: number = 15) {
        this.interval = interval;
        this.state = ScheduleState.NONE;
    }

    /**
     * 스케줄러를 시작한다.
     */
    public start() {
        this.state = ScheduleState.STARTING;
        this.is_working = false;
        this.task = cron.schedule(`*/${this.interval} * * * * *`, this.workTask.bind(this));
        this.addEventHandlers();
        this.state = ScheduleState.RUNNING;
    }

    /**
     * 스케줄러의 종료명령을 실행한다.
     * 스케줄러의 진행중인 작업이 완료되기 위해서는 waitForStop 를 이용하여 완료될 때 까지 대기하여야 한다.
     */
    public stop() {
        this.state = ScheduleState.STOPPING;

        // 작업이 실행중이 아니면 즉시 종료한다. 그렇지 않으면 대기한다.
        if (!this.is_working) {
            this.state = ScheduleState.STOPPED;
        }
    }

    private stopTask() {
        if (this.task !== null) {
            this.task.stop();
            this.removeEventHandlers();
            this.task = null;
        }
    }

    /**
     * 스케줄러의 진행중인 작업이 완전히 종료될 때 까지 대기한다.
     * @param timeout Timeout milli seconds
     */
    public waitForStop(timeout: number = 60000): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const start = Math.floor(new Date().getTime() / 1000);
            const wait = () => {
                if (this.state === ScheduleState.STOPPED) {
                    this.stopTask();
                    resolve(true);
                } else {
                    const now = Math.floor(new Date().getTime() / 1000);
                    if (now - start < timeout) setTimeout(wait, 10);
                    else {
                        this.stopTask();
                        resolve(false);
                    }
                }
            };
            wait();
        });
    }

    /**
     * If the work is running, return true
     */
    public isRunning(): boolean {
        return this.task !== null;
    }

    /**
     * If the work is running, return true
     */
    public isWorking(): boolean {
        return this.is_working;
    }

    /**
     * Enter the option needed to perform the task
     * @param options The option needed to perform the task
     */
    // tslint:disable-next-line:no-empty
    public setOption(options: any) {}

    /**
     * It's a function where the work takes place.
     * This method is overridden to implement the actual code.
     * @private
     */
    private async workTask() {
        if (this.state === ScheduleState.STOPPED) return;
        if (this.is_working) return;

        this.is_working = true;
        try {
            await this.work();
        } catch (error) {
            console.error(`Failed to execute a scheduler: ${error}`);
        }
        this.is_working = false;

        if (this.state === ScheduleState.STOPPING) {
            this.state = ScheduleState.STOPPED;
        }
    }

    /**
     * It's a function where the work takes place.
     * This method is overridden to implement the actual code.
     * @protected
     */
    // tslint:disable-next-line:no-empty
    protected async work() {}

    /**
     * Add event handlers
     * @protected
     */
    // tslint:disable-next-line:no-empty
    protected addEventHandlers() {}

    /**
     * Remove event handlers
     * @protected
     */
    // tslint:disable-next-line:no-empty
    protected removeEventHandlers() {}
}
