/** Numeric GitHub IDs survive account renames. Empty configuration denies everyone. */
export function isOperatorId(id: unknown, configured: string | undefined): boolean {
  return typeof id === 'string' && /^[0-9]+$/.test(id) &&
    (configured ?? '').split(',').map(value=>value.trim()).filter(value=>/^[0-9]+$/.test(value)).includes(id);
}
