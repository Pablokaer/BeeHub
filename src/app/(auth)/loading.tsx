import { Skeleton } from "@/components/ui/misc";

export default function Loading() {
  return (
    <div className="panel flex flex-col gap-3 p-6" aria-busy="true">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
