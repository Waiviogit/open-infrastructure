'use client';

import { useCallback, useMemo, useState } from 'react';

import { useI18n } from '@/i18n/providers/i18n-provider';
import type { Translate } from '@/i18n/types';
import { PlusIcon, TrashIcon } from '@/icons';

import {
  createEmptyArrayItem,
  createEmptyRow,
  OBJECT_BUILDER_LIMITS,
  recordToRows,
  rowsToRecord,
  validateRows,
  type ObjectBuilderArrayItem,
  type ObjectBuilderRow,
  type ObjectBuilderScalarType,
  type ObjectBuilderType,
  type ObjectBuilderValidationIssue,
} from '../../../domain/object-builder';
import { BusinessButton } from '../../ui/business-button';
import { BUSINESS_FIELD_CLASS, BUSINESS_FOCUS_RING } from '../../ui/classes';

export type ObjectBuilderProps = {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>, valid: boolean) => void;
  label?: string;
  disabled?: boolean;
  maxProperties?: number;
};

const ICON_SIZE = 16;

/**
 * Key | type | remove, value on its own line below. The builder lives in narrow containers
 * (modals, the sign panel), so the layout must not depend on the viewport width.
 */
const PROPERTY_GRID_CLASS =
  'grid grid-cols-[minmax(0,1fr)_minmax(0,8rem)_auto] items-start gap-2';
const PROPERTY_REMOVE_CELL_CLASS = 'col-start-3 row-start-1';
const PROPERTY_VALUE_CELL_CLASS = 'col-span-2 col-start-1 row-start-2 min-w-0';
/** Array items: type | value | remove. */
const ITEM_GRID_CLASS =
  'grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto] items-start gap-2';
/** Value placeholder cells (null, nested object) keep the field height so rows stay aligned. */
const VALUE_NOTE_CLASS =
  'flex min-h-10 items-center text-body-sm text-fg-secondary';
/** Logical start edge: nested rows indent on the reading side (RTL-safe). */
const NESTED_CLASS = 'flex flex-col gap-2 border-s-2 border-border ps-3';

function issueMessage(
  t: Translate,
  issue: ObjectBuilderValidationIssue,
): string {
  switch (issue.code) {
    case 'empty_key':
      return t('business_object_builder_error_empty_key');
    case 'duplicate_key':
      return t('business_object_builder_error_duplicate_key');
    case 'dangerous_key':
      return t('business_object_builder_error_dangerous_key');
    case 'key_too_long':
      return t('business_object_builder_error_key_too_long');
    case 'max_properties':
      return t('business_object_builder_error_max_properties');
    default:
      return t('business_object_builder_error_empty_key');
  }
}

function typeLabel(t: Translate, type: ObjectBuilderType): string {
  switch (type) {
    case 'string':
      return t('business_object_builder_type_string');
    case 'number':
      return t('business_object_builder_type_number');
    case 'boolean':
      return t('business_object_builder_type_boolean');
    case 'null':
      return t('business_object_builder_type_null');
    case 'object':
      return t('business_object_builder_type_object');
    case 'array':
      return t('business_object_builder_type_array');
    default:
      return type;
  }
}

function RemoveRowButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <BusinessButton
      variant="quiet"
      size="sm"
      disabled={disabled}
      aria-label={label}
      title={label}
      onClick={onClick}
      className="size-10 px-0 py-0 max-lg:size-11"
    >
      <TrashIcon size={ICON_SIZE} />
    </BusinessButton>
  );
}

function countNestedProperties(children: ObjectBuilderRow[]): number {
  return children.filter((child) => child.key.trim().length > 0).length;
}

type ScalarValueEditorProps = {
  itemType: ObjectBuilderScalarType;
  ariaLabel: string;
  placeholder?: string;
  value: string;
  boolValue: boolean;
  disabled: boolean;
  onValueChange: (value: string) => void;
  onBoolChange: (value: boolean) => void;
};

function ScalarValueEditor({
  itemType,
  ariaLabel,
  placeholder,
  value,
  boolValue,
  disabled,
  onValueChange,
  onBoolChange,
}: ScalarValueEditorProps) {
  if (itemType === 'null') {
    return <span className={`${VALUE_NOTE_CLASS} font-mono`}>null</span>;
  }
  if (itemType === 'boolean') {
    return (
      <span className="flex min-h-10 items-center">
        <input
          type="checkbox"
          aria-label={ariaLabel}
          checked={boolValue}
          disabled={disabled}
          onChange={(e) => onBoolChange(e.target.checked)}
          className={`size-5 rounded-btn accent-accent ${BUSINESS_FOCUS_RING}`}
        />
      </span>
    );
  }
  return (
    <input
      type="text"
      aria-label={ariaLabel}
      inputMode={itemType === 'number' ? 'decimal' : 'text'}
      placeholder={placeholder}
      value={value}
      disabled={disabled}
      onChange={(e) => onValueChange(e.target.value)}
      className={BUSINESS_FIELD_CLASS}
    />
  );
}

type ArrayItemsEditorProps = {
  items: ObjectBuilderArrayItem[];
  disabled: boolean;
  t: Translate;
  onChange: (items: ObjectBuilderArrayItem[]) => void;
};

function ArrayItemsEditor({ items, disabled, t, onChange }: ArrayItemsEditorProps) {
  return (
    <div className={NESTED_CLASS}>
      {items.map((item) => (
        <div key={item.id} className={ITEM_GRID_CLASS}>
          <select
            aria-label={t('business_object_builder_col_type')}
            value={item.type}
            disabled={disabled}
            onChange={(e) => {
              const nextType = e.target.value as ObjectBuilderScalarType;
              onChange(
                items.map((row) =>
                  row.id === item.id
                    ? {
                        ...row,
                        type: nextType,
                        value: nextType === 'null' ? '' : row.value,
                        boolValue: nextType === 'boolean' ? row.boolValue : false,
                      }
                    : row,
                ),
              );
            }}
            className={BUSINESS_FIELD_CLASS}
          >
            {(['string', 'number', 'boolean', 'null'] as const).map((scalar) => (
              <option key={scalar} value={scalar}>
                {typeLabel(t, scalar)}
              </option>
            ))}
          </select>
          <ScalarValueEditor
            itemType={item.type}
            ariaLabel={t('business_object_builder_col_value')}
            value={item.value}
            boolValue={item.boolValue}
            disabled={disabled}
            onValueChange={(next) =>
              onChange(
                items.map((row) => (row.id === item.id ? { ...row, value: next } : row)),
              )
            }
            onBoolChange={(next) =>
              onChange(
                items.map((row) =>
                  row.id === item.id ? { ...row, boolValue: next } : row,
                ),
              )
            }
          />
          <RemoveRowButton
            label={t('business_object_builder_remove')}
            disabled={disabled}
            onClick={() => onChange(items.filter((row) => row.id !== item.id))}
          />
        </div>
      ))}
      <BusinessButton
        size="sm"
        disabled={disabled}
        className="self-start"
        onClick={() => onChange([...items, createEmptyArrayItem()])}
      >
        <PlusIcon size={ICON_SIZE} />
        {t('business_object_builder_add_item')}
      </BusinessButton>
    </div>
  );
}

type PropertyRowsEditorProps = {
  rows: ObjectBuilderRow[];
  depth: number;
  disabled: boolean;
  maxProperties: number;
  issuesByRowId: Map<string, ObjectBuilderValidationIssue[]>;
  t: Translate;
  onChange: (rows: ObjectBuilderRow[]) => void;
};

function PropertyRowsEditor({
  rows,
  depth,
  disabled,
  maxProperties,
  issuesByRowId,
  t,
  onChange,
}: PropertyRowsEditorProps) {
  const allowObjectAndArray = depth === 0;
  const typeOptions: ObjectBuilderType[] = allowObjectAndArray
    ? ['string', 'number', 'boolean', 'null', 'object', 'array']
    : ['string', 'number', 'boolean', 'null'];

  const nonEmptyCount = rows.filter((row) => row.key.trim().length > 0).length;
  const atMax = nonEmptyCount >= maxProperties;

  function updateRow(rowId: string, patch: Partial<ObjectBuilderRow>) {
    onChange(rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function removeRow(rowId: string) {
    const next = rows.filter((row) => row.id !== rowId);
    onChange(next.length > 0 ? next : [createEmptyRow()]);
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const rowIssues = issuesByRowId.get(row.id) ?? [];
        return (
          <div key={row.id} className="flex flex-col gap-2">
            <div className={PROPERTY_GRID_CLASS}>
              <input
                type="text"
                aria-label={t('business_object_builder_col_key')}
                aria-invalid={rowIssues.length > 0 || undefined}
                value={row.key}
                disabled={disabled}
                placeholder={t('business_object_builder_key_placeholder')}
                onChange={(e) => updateRow(row.id, { key: e.target.value })}
                className={BUSINESS_FIELD_CLASS}
              />
              <select
                aria-label={t('business_object_builder_col_type')}
                value={row.type}
                disabled={disabled}
                onChange={(e) => {
                  const nextType = e.target.value as ObjectBuilderType;
                  const patch: Partial<ObjectBuilderRow> = { type: nextType };
                  if (nextType === 'object' && row.children.length === 0) {
                    patch.children = [createEmptyRow()];
                  }
                  if (nextType === 'array' && row.items.length === 0) {
                    patch.items = [createEmptyArrayItem()];
                  }
                  updateRow(row.id, patch);
                }}
                className={BUSINESS_FIELD_CLASS}
              >
                {typeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {typeLabel(t, opt)}
                  </option>
                ))}
              </select>
              <div className={PROPERTY_REMOVE_CELL_CLASS}>
                <RemoveRowButton
                  label={t('business_object_builder_remove')}
                  disabled={disabled}
                  onClick={() => removeRow(row.id)}
                />
              </div>
              {row.type === 'object' ? (
                <span
                  className={`${PROPERTY_VALUE_CELL_CLASS} ${VALUE_NOTE_CLASS}`}
                >
                  {t('business_object_builder_edit_n_properties', {
                    count: countNestedProperties(row.children),
                  })}
                </span>
              ) : row.type === 'array' ? null : (
                <div className={PROPERTY_VALUE_CELL_CLASS}>
                  <ScalarValueEditor
                    itemType={row.type}
                    ariaLabel={
                      row.key.trim()
                        ? `${t('business_object_builder_col_value')}: ${row.key.trim()}`
                        : t('business_object_builder_col_value')
                    }
                    placeholder={t('business_object_builder_col_value')}
                    value={row.value}
                    boolValue={row.boolValue}
                    disabled={disabled}
                    onValueChange={(next) => updateRow(row.id, { value: next })}
                    onBoolChange={(next) =>
                      updateRow(row.id, { boolValue: next })
                    }
                  />
                </div>
              )}
            </div>
            {rowIssues.length > 0 ? (
              <p className="text-caption text-error" role="alert">
                {rowIssues.map((issue) => issueMessage(t, issue)).join(' ')}
              </p>
            ) : null}
            {row.type === 'object' ? (
              <div className={`ms-2 ${NESTED_CLASS}`}>
                <PropertyRowsEditor
                  rows={row.children}
                  depth={depth + 1}
                  disabled={disabled}
                  maxProperties={maxProperties}
                  issuesByRowId={issuesByRowId}
                  t={t}
                  onChange={(children) => updateRow(row.id, { children })}
                />
              </div>
            ) : null}
            {row.type === 'array' ? (
              <ArrayItemsEditor
                items={row.items}
                disabled={disabled}
                t={t}
                onChange={(items) => updateRow(row.id, { items })}
              />
            ) : null}
          </div>
        );
      })}
      <BusinessButton
        size="sm"
        disabled={disabled || atMax}
        className="self-start"
        onClick={() => onChange([...rows, createEmptyRow()])}
      >
        <PlusIcon size={ICON_SIZE} />
        {t('business_object_builder_add_property')}
      </BusinessButton>
    </div>
  );
}

export function ObjectBuilder({
  value,
  onChange,
  label,
  disabled = false,
  maxProperties = OBJECT_BUILDER_LIMITS.maxProperties,
}: ObjectBuilderProps) {
  const { t } = useI18n();
  const [rows, setRows] = useState(() => {
    const initial = recordToRows(value);
    return initial.length > 0 ? initial : [createEmptyRow()];
  });

  const commitRows = useCallback(
    (next: ObjectBuilderRow[]) => {
      setRows(next);
      const issues = validateRows(next);
      onChange(rowsToRecord(next), issues.length === 0);
    },
    [onChange],
  );

  const issues = useMemo(() => validateRows(rows), [rows]);
  const issuesByRowId = useMemo(() => {
    const map = new Map<string, ObjectBuilderValidationIssue[]>();
    for (const issue of issues) {
      if (issue.rowId) {
        const list = map.get(issue.rowId) ?? [];
        list.push(issue);
        map.set(issue.rowId, list);
      }
    }
    return map;
  }, [issues]);

  const globalIssues = issues.filter((issue) => !issue.rowId);
  const previewJson = useMemo(
    () => JSON.stringify(rowsToRecord(rows), null, 2),
    [rows],
  );

  return (
    <div className="flex flex-col gap-2 text-body-sm">
      {label ? <span className="font-weight-label">{label}</span> : null}
      <p className="text-caption text-fg-secondary">
        {t('business_object_builder_custom_properties')}
      </p>
      <PropertyRowsEditor
        rows={rows}
        depth={0}
        disabled={disabled}
        maxProperties={maxProperties}
        issuesByRowId={issuesByRowId}
        t={t}
        onChange={commitRows}
      />
      {globalIssues.length > 0 ? (
        <p className="text-caption text-error" role="alert">
          {globalIssues.map((issue) => issueMessage(t, issue)).join(' ')}
        </p>
      ) : null}
      <details className="rounded-card border border-border px-3 py-2">
        <summary
          className={`cursor-pointer rounded-btn text-caption font-weight-label ${BUSINESS_FOCUS_RING}`}
        >
          {t('business_object_builder_json_preview')}
        </summary>
        <pre className="mt-2 overflow-x-auto font-mono text-caption text-fg-secondary">
          {previewJson}
        </pre>
      </details>
    </div>
  );
}
