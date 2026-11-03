import { router, type Href } from 'expo-router';

import { Text } from '@/components/ui/text';

type AuthFooterLinkProps = { prompt: string; action: string; href: Href };

/** "Already have an account? Sign in" — swaps between the auth forms without stacking them. */
export function AuthFooterLink({ prompt, action, href }: AuthFooterLinkProps) {
  return (
    <Text className="text-center font-inter text-[15px] text-muted-foreground">
      {prompt}{' '}
      <Text
        accessibilityRole="link"
        onPress={() => router.replace(href)}
        suppressHighlighting
        className="font-inter-semibold text-[15px] text-foreground"
      >
        {action}
      </Text>
    </Text>
  );
}
