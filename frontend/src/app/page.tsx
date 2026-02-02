import React from "react";
import FormRenderer from "@/components/main/index";
import type { FormConfig } from "@/components/utils/types";
import formConfig from "@/components/metadata/form.json" assert { type: "json" };

export default function Home() {
  const config = formConfig as FormConfig;
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
      <FormRenderer config={config} />
    </div>
  );
}
