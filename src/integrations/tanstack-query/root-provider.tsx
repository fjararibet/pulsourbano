import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

export function getContext() {
	const queryClient = new QueryClient();
	return { queryClient };
}

export default function TanstackQueryProvider({
	children,
	context,
}: {
	children: ReactNode;
	context: ReturnType<typeof getContext>;
}) {
	return (
		<QueryClientProvider client={context.queryClient}>
			{children}
		</QueryClientProvider>
	);
}
