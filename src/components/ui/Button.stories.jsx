import Button from "./Button";

export default {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
};

export const Default = { args: { children: "Click me" } };
export const Primary = { args: { variant: "primary", children: "Primary action" } };
