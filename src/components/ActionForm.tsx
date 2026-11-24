"use client";

import { startTransition } from "react";

type Props = Omit<React.FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit"> & {
  action: (data: FormData) => void;
};

// A plain <form action> resets every field once the action finishes, so a
// validation error would wipe what the person typed. Submitting this way
// keeps their input on screen while the server answers.
export function ActionForm({ action, children, ...rest }: Props) {
  return (
    <form
      {...rest}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      {children}
    </form>
  );
}
