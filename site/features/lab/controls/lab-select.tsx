"use client";

import * as React from "react";
import type { Select as SelectPrimitive } from "@base-ui/react/select";
import {
  Select as BaseSelect,
  SelectContent,
  SelectGroup,
  SelectItem as BaseSelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@site/components/ui/select";

type SelectItemProps = React.ComponentProps<typeof BaseSelectItem>;

export interface LabSelectItem<Value = unknown> {
  label: React.ReactNode;
  value: Value;
}

export function collectLabSelectItems<Value = unknown>(
  children: React.ReactNode,
) {
  const items: LabSelectItem<Value>[] = [];

  function visit(node: React.ReactNode) {
    React.Children.forEach(node, (child) => {
      if (
        !React.isValidElement<{ children?: React.ReactNode; value?: unknown }>(
          child,
        )
      ) {
        return;
      }

      if (child.type === SelectItem) {
        items.push({
          label: child.props.children,
          value: child.props.value as Value,
        });
        return;
      }

      visit(child.props.children);
    });
  }

  visit(children);
  return items;
}

function Select<Value, Multiple extends boolean | undefined = false>({
  children,
  items,
  ...props
}: SelectPrimitive.Root.Props<Value, Multiple>) {
  const inferredItems = React.useMemo(
    () => items ?? collectLabSelectItems<Value>(children),
    [children, items],
  );

  return (
    <BaseSelect<Value, Multiple> {...props} items={inferredItems}>
      {children}
    </BaseSelect>
  );
}

function SelectItem(props: SelectItemProps) {
  return <BaseSelectItem {...props} />;
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
