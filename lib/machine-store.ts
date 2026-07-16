export interface Machine {
  id?: number
  value: string
  label: string
  shift?: string
  startingPoint?: string
}

interface ApiMachine {
  id?: number
  value: string
  label: string
  shift?: string
  starting_point?: string
}

function fromApiMachine(item: ApiMachine): Machine {
  return {
    id: item.id,
    value: item.value,
    label: item.label,
    shift: item.shift,
    startingPoint: item.starting_point ?? undefined,
  }
}

export async function getMachines(): Promise<Machine[]> {
  try {
    const response = await fetch("/api/machines", { cache: "no-store" })
    if (!response.ok) throw new Error("Failed to fetch machines")
    const data: ApiMachine[] = await response.json()
    return data.map(fromApiMachine)
  } catch (error) {
    console.error("Error fetching machines:", error)
    return []
  }
}

export async function createMachine(
  machine: Omit<Machine, "id">
): Promise<Machine | null> {
  try {
    const response = await fetch("/api/machines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        value: machine.value,
        label: machine.label,
        shift: machine.shift,
        starting_point: machine.startingPoint ?? null,
      }),
    })
    if (!response.ok) throw new Error("Failed to create machine")
    const data: ApiMachine = await response.json()
    return fromApiMachine(data)
  } catch (error) {
    console.error("Error creating machine:", error)
    return null
  }
}

export async function updateMachine(machine: Machine): Promise<Machine | null> {
  try {
    const response = await fetch("/api/machines", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: machine.id,
        value: machine.value,
        label: machine.label,
        shift: machine.shift,
        starting_point: machine.startingPoint ?? null,
      }),
    })
    if (!response.ok) throw new Error("Failed to update machine")
    const data: ApiMachine = await response.json()
    return fromApiMachine(data)
  } catch (error) {
    console.error("Error updating machine:", error)
    return null
  }
}

export async function deleteMachine(id: number): Promise<boolean> {
  try {
    const response = await fetch(`/api/machines?id=${id}`, {
      method: "DELETE",
    })
    if (!response.ok) throw new Error("Failed to delete machine")
    return true
  } catch (error) {
    console.error("Error deleting machine:", error)
    return false
  }
}
