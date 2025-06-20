import { App, Modal, Setting } from "obsidian";

export class DatePickerModal extends Modal {
	private selectedDate: Date;
	private onSubmit: (date: Date) => void;

	constructor(app: App, onSubmit: (date: Date) => void) {
		super(app);
		this.onSubmit = onSubmit;
		this.selectedDate = new Date();
		this.selectedDate.setDate(this.selectedDate.getDate() - 1); // Default to yesterday
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Select Date for Timing Data Sync" });

		// Date input
		new Setting(contentEl)
			.setName("Date")
			.setDesc("Select the date to sync timing data for")
			.addText((text) => {
				const dateString = this.formatDate(this.selectedDate);
				text.setPlaceholder("YYYY-MM-DD")
					.setValue(dateString)
					.onChange((value) => {
						const date = new Date(value);
						if (!isNaN(date.getTime())) {
							this.selectedDate = date;
						}
					});

				// Set input type to date for better UX
				text.inputEl.type = "date";
				text.inputEl.max = this.formatDate(new Date()); // Cannot select future dates
			});

		// Quick date buttons
		const buttonContainer = contentEl.createDiv("date-picker-buttons");
		buttonContainer.style.marginTop = "10px";
		buttonContainer.style.display = "flex";
		buttonContainer.style.gap = "10px";
		buttonContainer.style.flexWrap = "wrap";

		const today = new Date();
		const quickDates = [
			{ label: "Yesterday", date: new Date(today.getTime() - 24 * 60 * 60 * 1000) },
			{ label: "2 days ago", date: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000) },
			{ label: "3 days ago", date: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000) },
			{ label: "1 week ago", date: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000) },
		];

		quickDates.forEach(({ label, date }) => {
			const button = buttonContainer.createEl("button", { text: label });
			button.style.padding = "5px 10px";
			button.style.marginRight = "5px";
			button.style.fontSize = "12px";
			button.addEventListener("click", () => {
				this.selectedDate = date;
				const dateInput = contentEl.querySelector('input[type="date"]') as HTMLInputElement;
				if (dateInput) {
					dateInput.value = this.formatDate(date);
				}
			});
		});

		// Action buttons
		const actionContainer = contentEl.createDiv("modal-button-container");
		actionContainer.style.marginTop = "20px";
		actionContainer.style.display = "flex";
		actionContainer.style.gap = "10px";
		actionContainer.style.justifyContent = "flex-end";

		const cancelButton = actionContainer.createEl("button", { text: "Cancel" });
		cancelButton.addEventListener("click", () => {
			this.close();
		});

		const syncButton = actionContainer.createEl("button", { text: "Sync Data" });
		syncButton.style.backgroundColor = "var(--interactive-accent)";
		syncButton.style.color = "var(--text-on-accent)";
		syncButton.addEventListener("click", () => {
			this.onSubmit(this.selectedDate);
			this.close();
		});

		// Focus the sync button
		setTimeout(() => syncButton.focus(), 100);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	private formatDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}
}