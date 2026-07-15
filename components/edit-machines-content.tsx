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

const inputCls =
  "w-full rounded-md border bg-background px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-ring"

interface MachineEditRowProps {
  machine: Machine
  draftKey: string
  draft: Machine
  onDraftChange: (machine: Machine) => void
  onConfirm: () => void
  onCancel: () => void
}

function MachineEditRow({ machine, draft, onDraftChange, onConfirm, onCancel }: MachineEditRowProps) {
  return (
    <TableRow className="bg-accent/20">
      <TableCell className="py-1.5 px-4 text-center">
        <input
          className={inputCls}
          value={draft.value}
          onChange={(e) =>
            onDraftChange({ ...draft, value: e.target.value.toUpperCase() })
          }
          placeholder="R001"
        />
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
}

export function EditMachinesContent({ onSaveRef }: EditMachinesContentProps) {
  const [machines, setMachines] = React.useState<Machine[]>([])
  const [drafts, setDrafts] = React.useState<Record<string, Machine>>({})
  const [loading, setLoading] = React.useState(true)
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [adding, setAdding] = React.useState(false)
  const [activeAddDraftKey, setActiveAddDraftKey] = React.useState<string | null>(null)
  const [pendingDraftKeys, setPendingDraftKeys] = React.useState<string[]>([])

  React.useEffect(() => {
    getMachines().then((m) => {
      setMachines(m)
      setLoading(false)
    })
  }, [])

  const handleSaveAll = React.useCallback(async () => {
    if (pendingDraftKeys.length === 0) return

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
  }, [drafts, machines, pendingDraftKeys])

  React.useEffect(() => {
    if (onSaveRef) {
      onSaveRef.current = handleSaveAll
    }
  }, [handleSaveAll, onSaveRef])

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

      <div className="rounded-xl border bg-card overflow-hidden text-xs">
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
                  onDraftChange={(m) => updateDraft(activeAddDraftKey, m)}
                  onConfirm={confirmDraft}
                  onCancel={cancelEdit}
                />
              )}
              {pendingDraftKeys
                .filter((key) => !/^\d+$/.test(key) && drafts[key])
                .map((key) => (
                  <TableRow key={key} className="h-10 bg-emerald-50/60 dark:bg-emerald-950/20">
                    <TableCell className="py-1.5 px-4 text-center">
                      <span className="font-mono font-bold tracking-wider">
                        {drafts[key]?.value}
                      </span>
                    </TableCell>
                    <TableCell className="py-1.5 px-4 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-1">
                        <span>{drafts[key]?.label}</span>
                        <span className="text-[10px] text-emerald-600 font-medium uppercase tracking-wide">
                          Pending Save
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-1.5 px-4 text-center text-muted-foreground">
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
                ))}
              {machines.map((machine) => {
                const draftKey = `${machine.id}`
                const isEditing = editingId === machine.id
                if (isEditing && drafts[draftKey]) {
                  return (
                    <MachineEditRow
                      key={machine.id}
                      machine={machine}
                      draftKey={draftKey}
                      draft={drafts[draftKey]}
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
                return (
                  <TableRow key={machine.id ?? machine.value} className="h-10">
                    <TableCell className="py-1.5 px-4 text-center">
                      <span className="font-mono font-bold tracking-wider">
                        {displayMachine.value}
                      </span>
                    </TableCell>
                    <TableCell className="py-1.5 px-4 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-1">
                        <span>{displayMachine.label}</span>
                        {pendingDraft && (
                          <span className="text-[10px] text-emerald-600 font-medium uppercase tracking-wide">
                            Pending Save
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-1.5 px-4 text-center text-muted-foreground">
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
