import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { DeploymentFormValues } from "@/lib/types";
import { Eye, EyeOff, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";

interface EnvVariablesModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function EnvVariablesModal({
	open,
	onOpenChange,
}: EnvVariablesModalProps) {
	const { control, register, trigger } = useFormContext<DeploymentFormValues>();

	const { fields, append, remove } = useFieldArray({
		control,
		name: "env",
	});

	useEffect(() => {
		if (open && fields.length === 0) {
			append({ key: "", value: "" });
		}
	}, [open, append, fields.length]);

	const [visibleFields, setVisibleFields] = useState<Set<number>>(new Set());

	const toggleVisibility = (index: number) => {
		setVisibleFields((prev) => {
			const next = new Set(prev);
			// eslint-disable-next-line @typescript-eslint/no-unused-expressions
			next.has(index) ? next.delete(index) : next.add(index);
			return next;
		});
	};

	const handleSubmit = async () => {
		const isValid = await trigger("env");
		if (isValid) onOpenChange(false);
	};

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
		>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Add Environment Variables</DialogTitle>
				</DialogHeader>

				{fields.map((_, index) => (
					<div
						key={`env-${index}`}
						className="flex items-center gap-2"
					>
						<Input
							type="text"
							placeholder="KEY"
							className="flex-1"
							{...register(`env.${index}.key`)}
						/>
						<div className="relative flex-1">
							<Input
								type={visibleFields.has(index) ? "text" : "password"}
								placeholder="VALUE"
								className="pr-9"
								{...register(`env.${index}.value`)}
							/>
							<button
								type="button"
								onClick={() => toggleVisibility(index)}
								className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							>
								{visibleFields.has(index) ? (
									<EyeOff className="w-4 h-4" />
								) : (
									<Eye className="w-4 h-4" />
								)}
							</button>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => remove(index)}
							disabled={fields.length === 1}
						>
							<X className="w-4 h-4" />
						</Button>
						{index === fields.length - 1 && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => append({ key: "", value: "" })}
							>
								<Plus className="w-4 h-4" />
							</Button>
						)}
					</div>
				))}

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						type="button"
						className="bg-blue-600 hover:bg-blue-700 text-white"
						onClick={handleSubmit}
					>
						Add Variables
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
