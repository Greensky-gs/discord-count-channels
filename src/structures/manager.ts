import { ChannelType, Client, Collection, OverwriteData } from 'discord.js';
import { Connection } from 'mysql';
import { counterType, configsType, countChannelType, createCountersType, databaseTable, databaseType, databaseConfig, databaseValueType } from '../typings/typings';
import { getValidChannelOrder } from '../utils/functions';
import { existsSync, writeFileSync } from 'node:fs';
import JSONDb from 'easy-json-database';

export class Counter<T extends databaseType = databaseType> {
    public readonly client: Client;
    public readonly database: databaseConfig<T>;
    public readonly configs: configsType;

    private db: databaseValueType<T>;
    private _cache: Collection<string, databaseTable> = new Collection();

    constructor(client: Client, database: databaseConfig<T>, configs?: configsType) {
        this.client = client;
        this.database = database;

        this.configs = {
            defaultChannelType: configs?.defaultChannelType ?? 'voice',
            defaultChannelJoinableIfVoice: configs?.defaultChannelJoinableIfVoice ?? false,
            defaultChannelNames: configs?.defaultChannelNames ?? {
                all: 'All: {count}',
                bots: 'Bots: {count}',
                humans: 'Humans: {count}',
                category: '📊 Stats'
            },
            defaultChannelOrders: getValidChannelOrder(configs?.defaultChannelOrders),
            defaultChannelEnabled: {
                all: configs?.defaultChannelEnabled?.all ?? true,
                bots: configs?.defaultChannelEnabled?.bots ?? true,
                humans: configs?.defaultChannelEnabled?.humans ?? true
            },
            defaultLocale: (configs?.defaultLocale ?? 'en').length > 2 ? 'en' : configs?.defaultLocale ?? 'en'
        };
    }

    public isMySQL(): this is Counter<'mysql'> {
        return this.database.type === 'mysql';
    }
    public isJSON(): this is Counter<'json'> {
        return this.database.type === 'json';
    }

    private query<K = any>(sql: string): Promise<K[]> {
        if (this.isMySQL()) {
            return new Promise<K[]>((resolve, reject) => {
                this.database.connection.query(sql, (error, request) => {
                    if (error) return reject(error);
                    resolve(request);
                });
            });
        }
    }

    private async setupDb() {
        if (this.isJSON()) {
            if (!existsSync(this.database.filePath)) {
                writeFileSync(this.database.filePath, '{}');
            }
            (this.db as databaseValueType<'json'>) = new JSONDb(this.database.filePath);
        } else if (this.isMySQL()) {
            await this.query(`CREATE TABLE IF NOT EXISTS counters (
guild_id TEXT(255) NOT NULL PRIMARY KEY,
enabled TEXT(3) NOT NULL DEFAULT '${this.generateEnableList()}',
all_chan VARCHAR(255) DEFAULT NULL,
humans VARCHAR(255) DEFAULT NULL,
bots VARCHAR(255) DEFAULT NULL,
category VARCHAR(255) NOT NULL,
all_name VARCHAR(255) DEFAULT NULL,
bots_name VARCHAR(255) DEFAULT NULL,
humans_name VARCHAR(255) DEFAULT NULL,
locale VARCHAR(2) NOT NULL DEFAULT '${this.configs.defaultLocale}',
channelType VARCHAR(255) NOT NULL DEFAULT '${this.configs?.defaultChannelType}'
        )`);
        }

        return true;
    }

    public async start() {
        await this.setupDb()       
        await this.fillCache();

        this.setEvent();
        this.syncCounters();
    }
    public getEnabled({ guild_id, type }: { guild_id: string; type: counterType }) {
        const mapping: Record<counterType, number> = {
            all: 0,
            bots: 1,
            humans: 2
        };
        const enabledList = this._cache.get(guild_id)?.enabled;
        if (!enabledList) return this.configs.defaultChannelEnabled[type];

        return enabledList[mapping[type]] === 't' ? true : false;
    }
    private setEnabled({
        type,
        state,
        guild_id
    }: {
        type: counterType;
        state: boolean;
        guild_id: string;
    }): Promise<databaseTable> {
        return new Promise(async (resolve) => {
            let list = this._cache.get(guild_id).enabled;

            const mapping: Record<counterType, number> = {
                all: 0,
                bots: 1,
                humans: 2
            };
            const arr = [...list];

            arr[mapping[type]] = state ? 't' : 'f';
            list = arr.join('');

            this._cache.set(guild_id, {
                ...this._cache.get(guild_id),
                enabled: list
            });

            await this.updateDatabase(guild_id).catch(() => {});
            resolve(this.cache.get(guild_id));
        });
    }
    private generateEnableList(configs?: { all?: boolean; humans?: boolean; bots?: boolean }) {
        const toStr = (bool: boolean) => (bool ? 't' : 'f');
        if (configs) {
            let str = '';
            for (const x of ['all', 'bots', 'humans'] as counterType[]) {
                str += toStr(configs[x] ?? this.configs.defaultChannelEnabled[x]);
            }
            return str;
        }
        return (
            toStr(this.configs.defaultChannelEnabled.all) +
            toStr(this.configs.defaultChannelEnabled.bots) +
            toStr(this.configs.defaultChannelEnabled.humans)
        );
    }
    private async fillCache(): Promise<void> {
        if (this.isMySQL()) {
            const datas = await this.query<databaseTable>(`SELECT * FROM counters`);
    
            for (const data of datas) {
                this._cache.set(data.guild_id, data);
            }
        } else if (this.isJSON()) {
            this._cache = new Collection<string, databaseTable>(this.db.all().map(({ key, data }) => [key, data as databaseTable]));
        }
    }
    public changeCounterName({
        guild_id,
        counter,
        name
    }: {
        guild_id: string;
        counter: counterType;
        name: string;
    }): Promise<databaseTable> {
        return new Promise(async (resolve, reject) => {
            if (!this._cache.has(guild_id)) return reject('Guild not registered');
            const datas = this._cache.get(guild_id);

            const mapping: Record<counterType, 'all_name' | 'bots_name' | 'humans_name'> = {
                all: 'all_name',
                bots: 'bots_name',
                humans: 'humans_name'
            };
            datas[mapping[counter]] = name;
            this._cache.set(guild_id, datas);

            await this.updateCounters(guild_id);
            resolve(datas);
        });
    }
    private updateCounters(guild_id: string): Promise<void> {
        if (!this._cache.has(guild_id)) return;
        return new Promise(async (resolve, reject) => {
            const { all_chan, bots, humans, channelType } = this._cache.get(guild_id);
            const guild = await this.client.guilds.fetch(guild_id);

            if (!guild) return reject('Guild not found');

            const promises = [];
            await guild.members.fetch();

            const ids: Record<counterType, string> = {
                all: '',
                bots: '',
                humans: ''
            };

            if (this.getEnabled({ guild_id, type: 'all' })) {
                const channel =
                    (await guild.channels.fetch(all_chan).catch(() => {})) ??
                    (await guild.channels.create({
                        name: this.resolveChannelName({
                            guild_id,
                            channel: 'all',
                            int: 0
                        }),
                        type: this.getChannelType(channelType)
                    }));

                if (channel)
                    promises.push(
                        channel.setName(
                            this.resolveChannelName({
                                guild_id,
                                channel: 'all',
                                int: guild.memberCount
                            })
                        )
                    );
                ids.all = channel.id;
            }
            if (this.getEnabled({ guild_id, type: 'bots' })) {
                const channel =
                    (await guild.channels.fetch(bots).catch(() => {})) ??
                    (await guild.channels.create({
                        name: this.resolveChannelName({
                            guild_id,
                            channel: 'bots',
                            int: 0
                        }),
                        type: this.getChannelType(channelType)
                    }));

                if (channel)
                    promises.push(
                        channel.setName(
                            this.resolveChannelName({
                                guild_id,
                                channel: 'bots',
                                int: guild.members.cache.filter((x) => x.user.bot).size
                            })
                        )
                    );
                ids.bots = channel.id;
            }
            if (this.getEnabled({ guild_id, type: 'humans' })) {
                const channel =
                    (await guild.channels.fetch(humans).catch(() => {})) ??
                    (await guild.channels.create({
                        name: this.resolveChannelName({
                            guild_id,
                            channel: 'humans',
                            int: 0
                        }),
                        type: this.getChannelType(channelType)
                    }));
                if (channel)
                    promises.push(
                        channel.setName(
                            this.resolveChannelName({
                                guild_id,
                                channel: 'humans',
                                int: guild.members.cache.filter((x) => !x.user.bot).size
                            })
                        )
                    );
                ids.humans = channel.id;
            }

            this.cache.set(guild_id, {
                ...this.cache.get(guild_id),
                all_chan: ids.all,
                humans: ids.humans,
                bots: ids.bots
            });

            await Promise.all([
                ...promises,
                this.updateDatabase(guild_id).catch(() => {})
            ]);
            resolve();
        });
    }
    private async updateDatabase(guild_id: string) {
        const values = this._cache.get(guild_id);

        if (this.isJSON()) {
            this.db.set(guild_id, values)
        } else if (this.isMySQL()) {
            await this.query(
                `UPDATE counters SET all_chan="${values.all_chan}", humans="${values.humans}", bots="${values.bots}", category="${values.category}", all_name="${this.getVar(values.all_name)}", bots_name="${this.getVar(values.bots_name)}", humans_name="${this.getVar(values.humans_name)}", locale="${values.locale}", channelType="${values.channelType}", enabled="${values.enabled}" WHERE guild_id="${guild_id}"`
            ).catch(() => {})
        }
        return true;
    }
    private resolveChannelName({ guild_id, channel, int }: { guild_id: string; channel: counterType; int: number }) {
        const x: Record<string, 'all_name' | 'bots_name' | 'humans_name'> = {
            all: 'all_name',
            bots: 'bots_name',
            humans: 'humans_name'
        };
        return this._cache
            .get(guild_id)
            [x[channel]].replace(/\{count\}/g, int.toLocaleString(this._cache.get(guild_id).locale));
    }
    private async createDatabase(values: databaseTable) {
        if (this.isJSON()) {
            this.db.set(values.guild_id, values);
        } else if (this.isMySQL()) {
            await this.query(
                `INSERT INTO counters (guild_id, enabled, all_chan, humans, bots, category, all_name, bots_name, humans_name, locale, channelType) VALUES ("${
                    values.guild_id
                }", "${values.enabled}", "${values.all_chan}", "${values.humans}", "${values.bots}", "${values.category}", "${this.getVar(values.all_name)}", "${this.getVar(values.bots_name)}", "${this.getVar(values.humans_name)}", "${values.locale}", "${values.channelType}" )`
            );
        }
        return true
    }
    public createCounters({
        guild,
        category,
        enable = {},
        names = {},
        channelsType = this.configs.defaultChannelType,
        order,
        locale = this.configs.defaultLocale,
        voiceJoinable = false
    }: createCountersType): Promise<databaseTable> {
        order = getValidChannelOrder(order);

        (['all', 'bots', 'humans'] as counterType[]).forEach((x) => {
            names[x] = names[x] ?? this.configs.defaultChannelNames[x];
            enable[x] = enable[x] ?? this.configs.defaultChannelEnabled[x];
        });

        return new Promise(async (resolve, reject) => {
            if (this._cache.has(guild.id)) return reject('Guild already registered');

            const permissionOverwrites: OverwriteData[] = [
                Object.assign(
                    {
                        id: guild.id
                    },
                    voiceJoinable ? { allow: ['Connect'] } : ({ deny: ['Connect'] } as any)
                )
            ];

            if (!category) {
                category = await guild.channels.create({
                    name: names.category ?? this.configs.defaultChannelNames.category,
                    type: ChannelType.GuildCategory,
                    position: 1,
                    permissionOverwrites
                });
            }

            const type = this.getChannelType(channelsType);
            const chans: Record<string, Record<'id', undefined>> = {
                all: { id: undefined },
                bots: { id: undefined },
                humans: { id: undefined }
            };

            for (const orderData of order) {
                if (enable[orderData])
                    chans[orderData] = await guild.channels.create({
                        name: names[orderData],
                        type,
                        parent: category,
                        permissionOverwrites
                    });
            }

            const data = {
                enabled: this.generateEnableList(enable),
                all_chan: chans?.all?.id ?? '',
                all_name: names.all,
                guild_id: guild.id,
                bots: chans?.bots?.id ?? '',
                bots_name: names.bots,
                humans: chans?.humans?.id ?? '',
                humans_name: names?.humans,
                category: category.id,
                locale: locale,
                channelType: channelsType
            };
            this._cache.set(guild.id, data);

            await this.updateCounters(guild.id);
            await this.createDatabase(data).catch(() => {});

            return resolve(data);
        });
    }
    public removeGuildCounter({
        guild_id,
        deleteChannels
    }: {
        guild_id: string;
        deleteChannels: boolean;
    }): Promise<databaseTable> {
        return new Promise(async (resolve, reject) => {
            if (!this._cache.has(guild_id)) return reject('Guild not exists in cache');
            const data = this._cache.get(guild_id);

            if (deleteChannels) {
                const guild = await this.client.guilds.fetch(data.guild_id).catch(() => {});
                if (!guild) return resolve(data);

                for (const id of [data.all_chan, data.bots, data.humans, data.category]) {
                    const chan = await guild.channels.fetch(id).catch(() => {});
                    if (chan) await chan.delete().catch(() => {});
                }
            }
            await this.deleteFromDatabase(guild_id).catch(() => {});
            resolve(data);
        });
    }
    private async deleteFromDatabase(guild_id: string) {
        if (this.isJSON()) {
            this.db.delete(guild_id);
        } else if (this.isMySQL()) {
            await this.query(`DELETE FROM counters WHERE guild_id="${guild_id}"`).catch(() => {});
        }
        return true;
    }
    public get cache() {
        return this._cache;
    }
    private getVar(str: string) {
        if (!str) return str;
        return str.replace(/"/g, '\\"');
    }
    public updateCounterEnable({
        guild_id,
        counter,
        state = true
    }: {
        guild_id: string;
        counter: counterType;
        state?: boolean;
    }): Promise<databaseTable> {
        return new Promise(async (resolve, reject) => {
            if (!this.cache.has(guild_id)) return reject('Guild not registered');

            await this.setEnabled({
                type: counter,
                guild_id,
                state
            });
            await this.updateCounters(guild_id);
            return resolve(this.cache.get(guild_id));
        });
    }
    public getChannelType(inp: countChannelType): any {
        const obj = {
            voice: ChannelType.GuildVoice,
            text: ChannelType.GuildText,
            stage: ChannelType.GuildStageVoice
        };
        return obj[inp];
    }
    private setEvent() {
        this.client.on('guildMemberAdd', (member) => {
            if (this._cache.has(member.guild.id)) this.updateCounters(member.guild.id);
        });
        this.client.on('guildMemberRemove', (member) => {
            if (this._cache.has(member.guild.id)) this.updateCounters(member.guild.id);
        });
    }
    private async syncCounters() {
        await this.client.guilds.fetch().catch(() => {});
        this.client.guilds.cache.forEach((guild) => {
            this.updateCounters(guild.id);
        });
    }
}
