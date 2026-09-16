import { useParams } from 'react-router-dom'

export function StudySetEditorPage() {
  const { setId } = useParams()
  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold">Edit study set</h1>
      <p className="text-muted-foreground">set id: {setId}</p>
    </div>
  )
}
