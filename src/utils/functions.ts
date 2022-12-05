import { channelCounterTypes } from '../typings/typings';

/**
 * Count how many times a value is occured in an array
 * @param array Array to test the values
 * @param value Value to test in the array
 * @returns Number of times the value is occured in the array
 */
export const countInArray = (array: any[], value: any): number => {
    return array.reduce((n, x) => n + (x === value), 0);
};
/**
 * Get a valid channel order
 * @param order Order to check
 * @returns A valid order
 */
export const getValidChannelOrder = (order: channelCounterTypes[]): channelCounterTypes[] => {
    if (!order || !(order instanceof Array) || order.length !== 3) return ['all', 'bots', 'humans'];

    let validArray = true;
    for (const x of ['all', 'bots', 'humans']) {
        if (countInArray(order, x) != 1) validArray = false;
    }
    if (!validArray) return ['all', 'bots', 'humans'];
    return order;
};
