import { channelCounterTypes } from "../typings/typings";

export const countInArray = (array: any[], value: any): number => {
    return array.reduce((n, x) => n + (x === value), 0);
}
export const getValidChannelOrder = (order: channelCounterTypes[]): channelCounterTypes[] => {
    if (!order || !(order instanceof Array) || order.length !== 3) return ['all', 'bots', 'humans'];

    let validArray = true;
    for (const x of ['all', 'bots', 'humans']) {
        if (countInArray(order, x) != 1) validArray = false;
    }
    if (!validArray) return ['all', 'bots', 'humans'];
    return order;
}
