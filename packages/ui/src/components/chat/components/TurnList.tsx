import React from 'react';

interface TurnListEntry {
    key: string;
}

interface TurnListProps<TEntry extends TurnListEntry> {
    entries: TEntry[];
    renderEntry: (entry: TEntry) => React.ReactNode;
}

interface TurnListItemProps<TEntry extends TurnListEntry> {
    entry: TEntry;
    renderEntry: (entry: TEntry) => React.ReactNode;
}

const TurnListItemComponent = <TEntry extends TurnListEntry>({ entry, renderEntry }: TurnListItemProps<TEntry>): React.ReactElement => {
    return (
        <div data-turn-entry={entry.key}>
            {renderEntry(entry)}
        </div>
    );
};

const MemoizedTurnListItem = React.memo(TurnListItemComponent) as typeof TurnListItemComponent;

const TurnList = <TEntry extends TurnListEntry>({ entries, renderEntry }: TurnListProps<TEntry>): React.ReactElement => {
    return (
        <>
            {entries.map((entry) => (
                <MemoizedTurnListItem
                    key={entry.key}
                    entry={entry}
                    renderEntry={renderEntry}
                />
            ))}
        </>
    );
};

export default React.memo(TurnList) as typeof TurnList;
