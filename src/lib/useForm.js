import { useCallback, useState } from "react";

export function useForm(initialValues, validate) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const handleChange = useCallback((name, value) => {
    setValues((v) => ({ ...v, [name]: value }));
  }, []);

  const handleBlur = useCallback((name) => {
    setTouched((t) => ({ ...t, [name]: true }));
    if (validate) setErrors(validate(values) || {});
  }, [values, validate]);

  const handleSubmit = useCallback((onSubmit) => async (e) => {
    e?.preventDefault?.();
    const nextErrors = validate ? validate(values) || {} : {};
    setErrors(nextErrors);
    setTouched(Object.keys(values).reduce((acc, k) => ({ ...acc, [k]: true }), {}));
    if (Object.keys(nextErrors).length === 0) {
      await onSubmit(values);
    }
  }, [values, validate]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return { values, errors, touched, handleChange, handleBlur, handleSubmit, reset, setValues };
}
