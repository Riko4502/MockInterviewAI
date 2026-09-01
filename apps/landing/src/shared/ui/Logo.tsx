import { CodeIcon } from "@packages/icons";
import { Link } from "@packages/ui";
import { cn } from "@packages/utils";

interface LogoProps {
  href?: string;
  className?: string;
}

export function Logo({ href = "/", className }: LogoProps) {
  return (
    <Link
      href={href}
      underline="none"
      className={cn("flex items-center gap-3 group text-inherit", className)}
    >
      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-500 flex items-center justify-center shadow-lg shadow-violet-500/25 group-hover:scale-105 group-hover:shadow-violet-500/40 transition-all duration-300">
        <CodeIcon className="w-5 h-5 text-white" />
      </div>
      <div className="flex flex-col">
        <span className="text-xl font-extrabold tracking-tight text-white group-hover:text-violet-400 transition-colors">
          DEVSYNC
        </span>
        <span className="text-[9px] font-mono tracking-widest text-slate-400 uppercase -mt-1">
          Interview AI
        </span>
      </div>
    </Link>
  );
}
