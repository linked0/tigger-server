/**
 *  The superclass of storage.
 *
 *  Copyright:
 *      Copyright (c) 2022 BOSAGORA Foundation All rights reserved.
 *
 *  License:
 *       MIT License. See LICENSE for details.
 */

import MybatisMapper, { Params } from "mybatis-mapper";
// tslint:disable-next-line:no-submodule-imports
import * as mysql from "mysql2/promise";
import { IDatabaseConfig } from "../../service/common/Config";
import { logger } from "../../service/common/Logger";

export class Storage {
    /**
     *  The instance of mysql Connection Pool.
     */
    protected pool: mysql.Pool;

    /**
     * Constructor
     * @param databaseConfig Valid value is of type IDatabaseConfig,
     * @param callback If provided, this function will be called when
     * the database was opened successfully or when an error occurred.
     * The first argument is an error object. If there is no error, this value is null.
     */
    constructor(databaseConfig: IDatabaseConfig, callback: (err: Error | null) => void) {
        const dbconfig: IDatabaseConfig = {
            host: databaseConfig.host,
            user: databaseConfig.user,
            password: databaseConfig.password,
            multipleStatements: databaseConfig.multipleStatements,
            port: Number(databaseConfig.port),
            waitForConnections: databaseConfig.waitForConnections,
            connectionLimit: Number(databaseConfig.connectionLimit),
            queueLimit: Number(databaseConfig.queueLimit),
        };
        this.pool = mysql.createPool(dbconfig);

        this.query(`CREATE DATABASE IF NOT EXISTS \`${databaseConfig.database}\`;`, [])
            .then(async (result) => {
                dbconfig.database = databaseConfig.database;
                this.pool = mysql.createPool(dbconfig);
                this.createTables()
                    .then(() => {
                        if (callback != null) callback(null);
                    })
                    .catch((err: any) => {
                        if (callback != null) callback(err);
                    });
            })
            .catch((err) => {
                if (callback != null) callback(err);
            });
    }

    /**
     * The main thread waits until the database is accessed.
     * The maximum waiting time is about 50 seconds.
     * @param databaseConfig Valid value is of type IDatabaseConfig,
     */
    public static waiteForConnection(databaseConfig: IDatabaseConfig): Promise<void> {
        const connection_config: mysql.ConnectionOptions = {
            host: databaseConfig.host,
            user: databaseConfig.user,
            password: databaseConfig.password,
            multipleStatements: databaseConfig.multipleStatements,
            port: Number(databaseConfig.port),
        };

        return new Promise<void>((resolve) => {
            let try_count = 0;
            const check_connection = async () => {
                try_count++;
                const connection = await mysql.createConnection(connection_config);
                connection
                    .connect()
                    .then(() => {
                        return resolve();
                    })
                    .catch((err) => {
                        if (try_count < 10) {
                            setTimeout(() => {
                                check_connection();
                            }, 5000);
                        }
                    });
            };
            check_connection();
        });
    }

    /**
     * Creates tables.
     * @returns Returns the Promise. If it is finished successfully the `.then`
     * of the returned Promise is called and if an error occurs the `.catch`
     * is called with an error.
     */
    public createTables(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            resolve();
        });
    }

    /**
     * Returns the DB connection of the Connection Pool.
     * @returns Returns the Promise. If it is finished successfully the `.then`
     * of the returned Promise is called and if an error occurs the `.catch`
     * is called with an error.
     */

    public getConnection(): Promise<mysql.PoolConnection> {
        return this.pool.getConnection();
    }

    /**
     * Close the database
     */
    public close(): Promise<void> {
        return this.pool.end();
    }

    /**
     * Execute SQL to query the database for data.
     * @param sql The SQL query to run.
     * @param params When the SQL statement contains placeholders,
     * you can pass them in here.
     * @param conn Use this if it is providing a db connection.
     * @returns Returns the Promise. If it is finished successfully the `.then`
     * of the returned Promise is called with the records
     * and if an error occurs the `.catch` is called with an error.
     */
    public query(sql: string, params: any, conn?: mysql.PoolConnection): Promise<any[]> {
        return new Promise<any[]>(async (resolve, reject) => {
            let connection: mysql.PoolConnection | null = null;
            try {
                if (!conn) connection = await this.getConnection();
                else connection = conn;

                const [rows] = await connection.query(sql, params);
                if (!conn) connection.release();
                resolve(rows as any);
            } catch (err) {
                if (!conn && connection) connection.release();
                return reject(err);
            }
        });
    }

    /**
     * Execute SQL to query the database for data with MybatisMapper.
     * @param namespace namespace of the query defined in the mapper file
     * @param sql ID of the query defined in the mapper file
     * @param params When the SQL statement contains placeholders,
     * you can pass them in here.
     * @param conn Use this if it is providing a db connection.
     */
    public queryForMapper(
        namespace: string,
        sql_id: string,
        param?: Params,
        conn?: mysql.PoolConnection
    ): Promise<any[]> {
        return new Promise<any[]>(async (resolve, reject) => {
            let connection: mysql.PoolConnection | null = null;
            try {
                if (!conn) connection = await this.getConnection();
                else connection = conn;
                const sql = MybatisMapper.getStatement(namespace, sql_id, param, { language: "sql", indent: "  " });
                // logger.debug("Create query :: \n" + sql);
                const [rows] = await connection.query(sql);
                if (!conn) connection.release();
                resolve(rows as any);
            } catch (err) {
                if (!conn && connection) connection.release();
                return reject(err);
            }
        });
    }

    /**
     * Executes the SQL query
     * @param sql The SQL query to run.
     * @param conn Use this if it is providing a db connection.
     * @returns Returns the Promise. If it is finished successfully the `.then`
     * of the returned Promise is called and if an error occurs the `.catch`
     * is called with an error.
     */
    protected exec(sql: string, conn?: mysql.PoolConnection): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            let connection: mysql.PoolConnection | null = null;
            try {
                if (!conn) connection = await this.getConnection();
                else connection = conn;
                await connection.query(sql);
                if (!conn) connection.release();
                resolve();
            } catch (err) {
                if (!conn && connection) connection.release();
                return reject(err);
            }
        });
    }

    /**
     * Mysql transaction statement
     * To start a transaction explicitly,
     * Open a transaction by issuing the beginning function
     * the transaction is open until it is explicitly
     * committed or rolled back.
     * @param conn Use this if it is providing a db connection must be released after transaction end.
     * @returns Returns the Promise. If it is finished successfully the `.then`
     * of the returned Promise is called and if an error occurs the `.catch`
     * is called with an error.
     */
    public begin(conn: mysql.PoolConnection): Promise<void> {
        return conn.beginTransaction();
    }

    /**
     * Mysql transaction statement
     * Commit the changes to the database by using this.
     * @returns Returns the Promise. If it is finished successfully the `.then`
     * of the returned Promise is called and if an error occurs the `.catch`
     * is called with an error.
     */
    public commit(conn: mysql.PoolConnection): Promise<void> {
        return conn.commit();
    }

    /**
     * Mysql transaction statement
     * If it does not want to save the changes,
     * it can roll back using this.
     * @param conn Use this if it is providing a db connection must be released after transaction end.
     * @returns Returns the Promise. If it is finished successfully the `.then`
     * of the returned Promise is called and if an error occurs the `.catch`
     * is called with an error.
     */
    public rollback(conn: mysql.PoolConnection): Promise<void> {
        return conn.rollback();
    }
}
