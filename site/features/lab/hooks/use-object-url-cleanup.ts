import { useEffect } from "react";

export function useObjectUrlCleanup(source: string) {
  useEffect(() => {
    return () => {
      if (source.startsWith("blob:")) URL.revokeObjectURL(source);
    };
  }, [source]);
}
