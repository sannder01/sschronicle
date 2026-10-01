import { api, json, readJson } from '@/lib/api'
import { updateTask, deleteTask } from '@/lib/tasks'
export const PATCH = api(async (req, { params }, { user }) => json(await updateTask(user.id,params.id,await readJson(req,8192))))
export const DELETE = api(async (req, { params }, { user }) => json(await deleteTask(user.id,params.id)))
