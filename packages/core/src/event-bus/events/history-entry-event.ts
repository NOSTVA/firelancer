import { HistoryEntryType, ID } from 'src/common/shared-types';
import { FirelancerEntityEvent } from '../firelancer-entity-event';
import { HistoryEntry } from 'src/entity/history-entry/history-entry.entity';
import { RequestContext } from 'src/common/request-context';

type HistoryInput =
  | {
      type: HistoryEntryType;
      data?: unknown;
    }
  | ID;

/**
 * @description
 * This event is fired whenever one HistoryEntry is added, updated or deleted.
 */
export class HistoryEntryEvent extends FirelancerEntityEvent<HistoryEntry, HistoryInput> {
  public readonly historyType: 'order' | 'customer' | string;

  constructor(
    ctx: RequestContext,
    entity: HistoryEntry,
    type: 'created' | 'updated' | 'deleted',
    historyType: 'order' | 'customer' | string,
    input?: HistoryInput,
  ) {
    super(entity, type, ctx, input);
    this.historyType = historyType;
  }
}
