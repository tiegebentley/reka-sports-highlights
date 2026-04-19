export function Dashboard() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-heading font-bold mb-6">Dashboard</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold mb-2">Total Videos</h3>
          <p className="text-3xl font-bold text-primary">0</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold mb-2">Processing</h3>
          <p className="text-3xl font-bold text-accent">0</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold mb-2">Completed</h3>
          <p className="text-3xl font-bold text-primary">0</p>
        </div>
      </div>
    </div>
  )
}
