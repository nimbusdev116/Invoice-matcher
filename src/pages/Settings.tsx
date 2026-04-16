export default function Settings() {
  return (
    <div className="flex flex-col h-full">
      <div className="h-[54px] bg-s1 border-b border-border flex items-center px-5 shrink-0">
        <h1 className="text-[15px] font-semibold">Settings</h1>
      </div>
      <div className="flex-1 flex items-center justify-center text-muted">
        <div className="text-center">
          <div className="text-4xl mb-3 opacity-40">⚙️</div>
          <div className="text-sm">Settings coming soon</div>
          <div className="text-xs mt-1">Profile, team management, Zoho connection</div>
        </div>
      </div>
    </div>
  )
}
