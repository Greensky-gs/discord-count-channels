export type channelCounterTypes = 'bots' | 'humans' | 'all';

export type configsType = {
    defaultChannelType: 'voice' | 'text' | 'stage';
    defaultChannelJoinableIfVoice: boolean;
    /**
     * Use {count} to set the number in the name
     */
    defaultChannelNames: Record<channelCounterTypes, string>;
    defaultChannelOrders: channelCounterTypes[];
    defaultChannelEnabled: Record<channelCounterTypes, boolean>;
}
export type databaseTable = {
    guild_id: string;
    enabled: string;
    all_chan: string;
    humans: string;
    bots: string;
    category: string;
    all_name: string;
    bots_name: string;
    humans_name: string;
}