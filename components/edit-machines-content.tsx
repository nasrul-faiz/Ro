"use client"

import * as React from "react"
import {
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  CheckIcon,
  XIcon,
} from "lucide-react"
import {
  getMachines,
  createMachine,
  updateMachine,
  deleteMachine,
  type Machine,
} from "@/lib/machine-store"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog"
import { compareCodes } from "@/lib/utils"

const inputCls =
  "w-full rounded-md border bg-background px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-ring"

interface MachineEditRowProps {
  machine: Machine
  draftKey: string
  draft: Machine
  duplicateValue?: boolean
  onDraftChange: (machine: Machine) => void
  onConfirm: () => void
  onCancel: () => void
}

function MachineEditRow({ machine, draft, duplicateValue, onDraftChange, onConfirm, onCancel }: MachineEditRowProps) {
  return (
    <TableRow className="bg-accent/20">
      <TableCell className="py-1.5 px-4 text-center">
        <input
          className={`${inputCls} ${duplicateValue ? "border-red-500 focus:ring-red-500" : ""}`}
          value={draft.value}
          onChange={(e) =>
            onDraftChange({ ...draft, value: e.target.value.toUpperCase() })
          }
          placeholder="R001"
        />
        {duplicateValue && (
          <p className="mt-1 text-left text-xs text-red-600">Duplicate route ID detected</p>
        )}
      </TableCell>
      <TableCell className="py-1.5 px-4 text-center">
        <input
          className={inputCls}
          value={draft.label}
          onChange={(e) =>
            onDraftChange({ ...draft, label: e.target.value })
          }
          placeholder="Route name"
        />
      </TableCell>
      <TableCell className="py-1.5 px-4 text-center">
        <select
          className={inputCls}
          value={draft.shift ?? "AM"}
          onChange={(e) => onDraftChange({ ...draft, shift: e.target.value })}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </TableCell>
      <TableCell className="py-1.5 px-4 text-center">
        <div className="flex justify-center gap-1">
          <button
            onClick={onConfirm}
            className="rounded p-1 bg-emerald-600/10 text-emerald-600 hover:bg-emerald-600/20"
          >
            <CheckIcon className="size-3.5" />
          </button>
          <button
            onClick={onCancel}
            className="rounded p-1 bg-red-600/10 text-red-600 hover:bg-red-600/20"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      </TableCell>
    </TableRow>
  )
}

interface EditMachinesContentProps {
  onSaveRef?: React.MutableRefObject<(() => Promise<void>) | null>
  onDirtyChange?: (dirty: boolean) => void
}

export function EditMachinesContent({ onSaveRef, onDirtyChange }: EditMachinesContentProps) {
  const [machines, setMachines] = React.useState<Machine[]>([])
  const [drafts, setDrafts] = React.useState<Record<string, Machine>>({})
  const [loading, setLoading] = React.useState(true)
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [activeAddDraftKey, setActiveAddDraftKey] = React.useState<string | null>(null)
  const [pendingDraftKeys, setPendingDraftKeys] = React.useState<string[]>([])
  const [saveError, setSaveError] = React.useState<string | null>(null)

  React.useEffect(() => {
    getMachines().then((m) => {
      setMachines(m)
      setLoading(false)
    })
  }, [])

  const allMachineRows = React.useMemo(() => {
    const rows: Machine[] = []

    for (const machine of machines) {
      rows.push(drafts[`${machine.id}`] ?? machine)
    }

    for (const key of pendingDraftKeys) {
      if (!/^\d+$/.test(key) && drafts[key]) {
        rows.push(drafts[key])
      }
    }

    if (activeAddDraftKey && drafts[activeAddDraftKey]) {
      rows.push(drafts[activeAddDraftKey])
    }

    return rows
  }, [machines, drafts, pendingDraftKeys, activeAddDraftKey])

  const duplicateMachineValues = React.useMemo(() => {
    const counts = new Map<string, number>()

    for (const machine of allMachineRows) {
      const value = machine.value.trim().toUpperCase()
      if (!value) continue
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }

    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([value]) => value)
    )
  }, [allMachineRows])

  const sortedMachines = React.useMemo(
    () => [...machines].sort((a, b) => compareCodes(a.value, b.value)),
    [machines]
  )

  const sortedPendingDraftKeys = React.useMemo(
    () =>
      pendingDraftKeys
        .filter((key) => !/^\d+$/.test(key) && drafts[key])
        .sort((leftKey, rightKey) =>
          compareCodes(drafts[leftKey]?.value ?? "", drafts[rightKey]?.value ?? "")
        ),
    [drafts, pendingDraftKeys]
  )

  const handleSaveAll = React.useCallback(async () => {
    setSaveError(null)
    if (pendingDraftKeys.length === 0) return

    if (duplicateMachineValues.size > 0) {
      setSaveError(
        `Duplicate route ID${duplicateMachineValues.size > 1 ? "s" : ""}: ${
          Array.from(duplicateMachineValues).join(", ")
        }`
      )
      return
    }

    for (const key of pendingDraftKeys) {
      const draft = drafts[key]
      if (!draft) continue

      const value = draft.value.trim().toUpperCase()
      if (!value) continue

      const isNewDraft = !/^\d+$/.test(key)
      if (isNewDraft) {
        if (machines.some((m) => m.value === value)) continue
        const created = await createMachine({
          value,
          label: draft.label.trim() || value,
          shift: draft.shift ?? "AM",
        })
        if (created) {
          setMachines((prev) => [...prev, created])
        }
      } else {
        const id = Number(key)
        if (draft.id && machines.some((m) => m.value === value && m.id !== draft.id)) continue
        const updated = await updateMachine({
          ...draft,
          id,
          value,
          label: draft.label.trim() || value,
          shift: draft.shift ?? "AM",
        })
        if (updated) {
          setMachines((prev) =>
            prev.map((m) => (m.id === updated.id ? updated : m))
          )
        }
      }
    }

    setDrafts({})
    setAdding(false)
    setEditingId(null)
    setActiveAddDraftKey(null)
    setPendingDraftKeys([])
  }, [drafts, duplicateMachineValues, machines, pendingDraftKeys])

  React.useEffect(() => {
    if (onSaveRef) {
      onSaveRef.current = handleSaveAll
    }
  }, [handleSaveAll, onSaveRef])

  React.useEffect(() => {
    onDirtyChange?.(pendingDraftKeys.length > 0)
  }, [pendingDraftKeys, onDirtyChange])

  function startAdd() {
    const draftKey = `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setAdding(true)
    setEditingId(null)
    setActiveAddDraftKey(draftKey)
    setDrafts((prev) => ({ ...prev, [draftKey]: { value: "", label: "", shift: "AM" } }))
  }

  function startEdit(id: number | undefined) {
    if (id === undefined) return
    const machine = machines.find((m) => m.id === id)
    if (machine) {
      const draftKey = `${id}`
      setEditingId(id)
      setDrafts((prev) => ({ ...prev, [draftKey]: { ...machine } }))
    }
  }

  function confirmDraft() {
    setSaveError(null)

    if (adding && activeAddDraftKey && drafts[activeAddDraftKey]) {
      const key = activeAddDraftKey
      setPendingDraftKeys((prev) => (prev.includes(key) ? prev : [...prev, key]))
      setAdding(false)
      setActiveAddDraftKey(null)
      return
    }

    if (editingId !== null) {
      const key = `${editingId}`
      if (drafts[key]) {
        setPendingDraftKeys((prev) => (prev.includes(key) ? prev : [...prev, key]))
        setEditingId(null)
      }
    }
  }

  function removeDraft(key: string) {
    setDrafts((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    setPendingDraftKeys((prev) => prev.filter((item) => item !== key))
    if (activeAddDraftKey === key) {
      setActiveAddDraftKey(null)
    }
  }

  function cancelEdit() {
    if (activeAddDraftKey) {
      removeDraft(activeAddDraftKey)
    }

    if (editingId !== null) {
      removeDraft(`${editingId}`)
    }

    setEditingId(null)
    setAdding(false)
  }

  function updateDraft(key: string, machine: Machine) {
    setSaveError(null)
    setDrafts((prev) => ({ ...prev, [key]: machine }))
  }

  async function handleDelete(machine: Machine) {
    if (!machine.id) return
    const ok = await deleteMachine(machine.id)
    if (ok) setMachines((prev) => prev.filter((m) => m.id !== machine.id))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {machines.length} route{machines.length !== 1 && "s"}
        </p>
        <Button
          size="sm"
          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={startAdd}
          disabled={editingId !== null || adding}
        >
          <PlusIcon className="size-3.5" />
          Add Route
        </Button>
      </div>

      {saveError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}

      <div className="glass-card overflow-hidden rounded-2xl text-xs">
        <div className="overflow-x-auto">
          <Table className="text-xs min-w-[500px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {["Route ID", "Route Name", "Shift", "Actions"].map((h) => (
                  <TableHead
                    key={h}
                    className="text-[11px] font-semibold tracking-wide py-2 px-4 text-center"
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {adding && activeAddDraftKey && drafts[activeAddDraftKey] && (
                <MachineEditRow
                  machine={{ value: "", label: "" }}
                  draftKey={activeAddDraftKey}
                  draft={drafts[activeAddDraftKey]}
                  duplicateValue={duplicateMachineValues.has(
                    drafts[activeAddDraftKey].value.trim().toUpperCase()
                  )}
                  onDraftChange={(m) => updateDraft(activeAddDraftKey, m)}
                  onConfirm={confirmDraft}
                  onCancel={cancelEdit}
                />
              )}
              {sortedPendingDraftKeys
                .map((key) => {
                  const normalizedValue = drafts[key]?.value?.trim().toUpperCase() ?? ""
                  const hasDuplicate = normalizedValue ? duplicateMachineValues.has(normalizedValue) : false

                  return (
                  <TableRow key={key} className="h-10 bg-emerald-50/60 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
                    <TableCell className={`py-1.5 px-4 text-center ${hasDuplicate ? "bg-red-50/80 text-red-700" : ""}`}>
                      <span className="font-mono font-bold tracking-wider">
                        {drafts[key]?.value}
                      </span>
                      {hasDuplicate && (
                        <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-red-600">
                          Duplicate
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5 px-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span>{drafts[key]?.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="py-1.5 px-4 text-center">
                      {drafts[key]?.shift ?? "AM"}
                    </TableCell>
                    <TableCell className="py-1.5 px-4 text-center">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => {
                            setAdding(true)
                            setEditingId(null)
                            setActiveAddDraftKey(key)
                          }}
                          className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
                        >
                          <PencilIcon className="size-3.5" />
                        </button>
                        <ConfirmDeleteDialog
                          trigger={
                            <button
                              className="rounded p-1 hover:bg-red-100 dark:hover:bg-red-900/40 text-muted-foreground hover:text-red-500"
                            >
                              <Trash2Icon className="size-3.5" />
                            </button>
                          }
                          title="Remove pending route?"
                          description="This pending route draft will be discarded."
                          onConfirm={() => removeDraft(key)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )})}
              {sortedMachines.map((machine) => {
                const draftKey = `${machine.id}`
                const isEditing = editingId === machine.id
                if (isEditing && drafts[draftKey]) {
                  const normalizedValue = drafts[draftKey].value.trim().toUpperCase()
                  return (
                    <MachineEditRow
                      key={machine.id}
                      machine={machine}
                      draftKey={draftKey}
                      draft={drafts[draftKey]}
                      duplicateValue={duplicateMachineValues.has(normalizedValue)}
                      onDraftChange={(m) => updateDraft(draftKey, m)}
                      onConfirm={confirmDraft}
                      onCancel={cancelEdit}
                    />
                  )
                }

                const pendingDraft = pendingDraftKeys.includes(draftKey)
                  ? drafts[draftKey]
                  : undefined
                const displayMachine = pendingDraft ?? machine
                const normalizedValue = displayMachine.value.trim().toUpperCase()
                const hasDuplicate = normalizedValue ? duplicateMachineValues.has(normalizedValue) : false
                const rowClass = pendingDraft
                  ? "h-10 text-orange-800 dark:text-orange-300"
                  : "h-10"
                const mutedCellClass = pendingDraft ? "" : "text-muted-foreground"
                return (
                  <TableRow key={machine.id ?? machine.value} className={rowClass}>
                    <TableCell className={`py-1.5 px-4 text-center ${hasDuplicate ? "bg-red-50/80 text-red-700" : ""}`}>
                      <span className="font-mono font-bold tracking-wider">
                        {displayMachine.value}
                      </span>
                      {hasDuplicate && (
                        <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-red-600">
                          Duplicate
                        </span>
                      )}
                    </TableCell>
                    <TableCell className={`py-1.5 px-4 text-center ${mutedCellClass}`}>
                      <div className="flex flex-col items-center gap-1">
                        <span>{displayMachine.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className={`py-1.5 px-4 text-center ${mutedCellClass}`}>
                      {displayMachine.shift ?? "AM"}
                    </TableCell>
                    <TableCell className="py-1.5 px-4 text-center">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => startEdit(machine.id)}
                          className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
                        >
                          <PencilIcon className="size-3.5" />
                        </button>
                        <ConfirmDeleteDialog
                          trigger={
                            <button
                              className="rounded p-1 hover:bg-red-100 dark:hover:bg-red-900/40 text-muted-foreground hover:text-red-500"
                            >
                              <Trash2Icon className="size-3.5" />
                            </button>
                          }
                          title="Delete route?"
                          description="This will permanently remove the route."
                          onConfirm={() => handleDelete(machine)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {machines.length === 0 && !adding && pendingDraftKeys.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-10 text-center text-muted-foreground"
                  >
                    No routes yet. Add one to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
