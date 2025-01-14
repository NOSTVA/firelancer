import { EntityIdStrategy } from '../entity-id-strategy';

/**
 * @description
 * An id strategy which uses auto-increment integers as primary keys
 * for all entities. This is the default strategy used by Firelancer.
 */
export class AutoIncrementIdStrategy implements EntityIdStrategy<'increment'> {
    readonly primaryKeyType = 'increment';
    decodeId(id: string | number): number {
        const asNumber = +id;
        return Number.isNaN(asNumber) ? -1 : asNumber;
    }
    encodeId(primaryKey: string | number): string {
        return primaryKey.toString();
    }
}
