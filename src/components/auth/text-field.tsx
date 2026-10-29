import { useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable } from 'react-native';

import { Icon } from '@/components/mintsy/icon';
import {
  FormControl,
  FormControlError,
  FormControlErrorText,
  FormControlHelper,
  FormControlHelperText,
  FormControlLabel,
  FormControlLabelText,
} from '@/components/ui/form-control';
import { HStack } from '@/components/ui/hstack';
import { Input, InputField, InputSlot } from '@/components/ui/input';

type TextFieldProps = ComponentProps<typeof InputField> & {
  label: string;
  error?: string;
  /** Shown under the field when there's no error. */
  helper?: string;
  /** Rendered on the label row's right edge (e.g. "Forgot password?"). */
  labelAccessory?: ReactNode;
  isReadOnly?: boolean;
};

/** Labelled 52pt field. Password fields (`secureTextEntry`) get a show/hide toggle. */
export function TextField({
  label,
  error,
  helper,
  labelAccessory,
  isReadOnly,
  secureTextEntry,
  ...inputProps
}: TextFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = !!secureTextEntry;

  return (
    <FormControl isInvalid={!!error} isReadOnly={isReadOnly} className="gap-2">
      <HStack className="items-center justify-between">
        <FormControlLabel className="mb-0">
          <FormControlLabelText className="font-inter-semibold text-[14px] text-secondary-foreground">
            {label}
          </FormControlLabelText>
        </FormControlLabel>
        {labelAccessory}
      </HStack>
      <Input
        className={`h-[52px] rounded-xl border-input bg-card dark:bg-card data-[focus=true]:border-brand dark:data-[focus=true]:border-brand ${
          isPassword ? 'pl-4 pr-1' : 'px-4'
        } ${isReadOnly ? 'opacity-70' : ''}`}
      >
        <InputField
          {...inputProps}
          // Stable selector for end-to-end tests: "Confirm new password" → input-confirm-new-password
          testID={inputProps.testID ?? `input-${label.toLowerCase().replace(/\s+/g, '-')}`}
          accessibilityLabel={label}
          editable={!isReadOnly}
          secureTextEntry={isPassword && !revealed}
          className="font-inter text-[16px] text-foreground placeholder:text-faint"
        />
        {isPassword ? (
          <InputSlot>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
              onPress={() => setRevealed((r) => !r)}
              className="h-11 w-11 items-center justify-center"
            >
              <Icon name={revealed ? 'eyeOff' : 'eye'} size={20} className="text-muted-foreground" />
            </Pressable>
          </InputSlot>
        ) : null}
      </Input>
      {error ? (
        <FormControlError className="mt-0">
          <FormControlErrorText className="font-inter text-[13px]">{error}</FormControlErrorText>
        </FormControlError>
      ) : helper ? (
        <FormControlHelper className="mt-0">
          <FormControlHelperText className="font-inter text-[13px] text-faint">{helper}</FormControlHelperText>
        </FormControlHelper>
      ) : null}
    </FormControl>
  );
}
