/**
 *  The class that manages the scheduler.
 *
 *  Copyright:
 *      Copyright (c) 2022 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */

import { SwapServer } from "./SwapServer";

export class ScheduleServer extends SwapServer {
    /**
     * 스케줄러들을 시작합니다.
     */
    public async start(): Promise<void> {
        await this.token_bridge_contract_manager.buildTokenInfo();
        this.schedules.forEach((m) => m.start());
    }

    /**
     * 스케줄러들을 종료합니다. 완전히 종료될 때까지 대기합니다.
     */
    public async stop(): Promise<void> {
        for (const m of this.schedules) m.stop();
        for (const m of this.schedules) await m.waitForStop();
    }
}
