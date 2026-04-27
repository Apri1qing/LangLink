import { useAppStore } from '../../stores/appStore'

interface SubPageTopBarProps {
  title: string
}

/**
 * 子页面顶栏：← 返回 + 页标题。
 * 用于 Settings / History 等非 Home 页，替代 Home 的三按钮 TopBar。
 */
export function SubPageTopBar({ title }: SubPageTopBarProps) {
  const setPage = useAppStore((s) => s.setPage)

  return (
    <div className="flex items-center px-2 py-3 bg-[#F2EDE8] sticky top-0 z-10">
      <button
        type="button"
        aria-label="返回"
        onClick={() => setPage('home')}
        className="w-11 h-11 flex items-center justify-center text-[#1A1A1A] text-xl active:scale-95 transition-transform"
      >
        ←
      </button>
      <h1 className="flex-1 text-base font-semibold text-[#1A1A1A] text-center pr-11">
        {title}
      </h1>
    </div>
  )
}
