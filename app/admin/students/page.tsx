import { createClient } from '@/lib/supabase/server'
import { createStudent, deleteStudent } from './actions'
import BulkImport from './BulkImport'

export default async function StudentsPage() {
  const supabase = await createClient()
  const { data: students } = await supabase
    .from('users')
    .select('*')
    .eq('role', 'student')
    .order('name')

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Students</h1>
      <BulkImport />
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <h2 className="font-medium mb-3">Add Student</h2>
        <form action={createStudent} className="flex gap-3 flex-wrap">
          <input name="name" placeholder="Full name" required
            className="border rounded px-3 py-2 text-sm w-48" />
          <input name="email" type="email" placeholder="Email" required
            className="border rounded px-3 py-2 text-sm w-64" />
          <button type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
            Add
          </button>
        </form>
      </div>
      <div className="bg-white rounded-lg shadow">
        <table className="text-sm">
          <thead className="border-b">
            <tr>
              <th className="text-left p-4 font-medium text-gray-600 w-48">Name</th>
              <th className="text-left p-4 font-medium text-gray-600 w-64">Email</th>
              <th className="p-4 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {(students ?? []).map((student: any) => (
              <tr key={student.id} className="border-b last:border-0">
                <td className="p-4 whitespace-nowrap">{student.name}</td>
                <td className="p-4 text-gray-600">{student.email}</td>
                <td className="p-4">
                  <form action={deleteStudent.bind(null, student.id)}>
                    <button type="submit" className="text-red-500 hover:text-red-700 text-xs">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
            {(students ?? []).length === 0 && (
              <tr><td colSpan={3} className="p-4 text-gray-400 text-center">No students yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
