import { Client, Collection } from "discord.js";
import { Connection } from "mysql";
import { configsType, countChannelType, createCountersType, databaseConfig, databaseTable, databaseType, databaseValueType, counterType } from './dist/typings/typings';
import { tableType } from './dist/index';

export class Counter<T extends databaseType = databaseType> {
    public constructor(client: Client, database: databaseConfig<T>, configs?: configsType);

    public readonly client: Client;
    public readonly database: Connection;
    public readonly configs: configsType;

    private db: databaseValueType<T>;

    /**
     * Send an SQL request to the database asynchronously, but manageable by promised
     * @param sql Sql query that you want to send to the database
     */
    private query<T = any>(sql: string): Promise<T[]>;

    /**
     * Start the manager.
     * @warning Use it once
     */
    public start(): Promise<void>;
    
    /**
     * Get the enabled state of a counter
     * @param options Options for the getting method
     */
    public getEnabled(options: { guild_id: string; type: counterType }): string;

    /**
     * Create counters for a server
     * @warning You cannot create counters twice
     * @param options Create options for the manager
     */
    public createCounters(options: createCountersType): Promise<tableType>;

    /**
     * Delete counters for a server
     * @warning This method works only for a setted server
     * @param options Options to provide to the function
     */
    public removeGuildCounter(options: { guild_id: string; deleteChannels: boolean }): Promise<tableType>;

    /**
     * Update a counter enabled
     * Allows to toggle counters of a server
     * @param options Options to provide to the update counter function
     */
    public updateCounterEnable(options: { guild_id: string; counter: counterType; state?: boolean; }): Promise<tableType>;

    /**
     * Get the cache of the manager
     */
    public get cache(): Collection<string, tableType>;

    /**
     * Convert a string type to a Discordjs' channel type
     * @param inp count channel type
     */
    public getChannelType(inp: countChannelType): any;

    /**
     * Change the name of a counter
     * 
     * The counter name is immediatly updated on the server
     * @param options Options for the change name method
     * 
     * Remember to use {count} to display count
     */
    public changeCounterName(options: { guild_id: string; counter: counterType; name: string }): Promise<tableType>;
}
