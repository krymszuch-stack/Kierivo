/**
 * Zgłoś skopiowanie dopiero po potwierdzeniu przez Clipboard API.
 *
 * Sama obecność `navigator.clipboard.writeText` nie oznacza sukcesu: przeglądarka
 * może odrzucić obietnicę z powodu uprawnień lub kontekstu strony. Wywołujący
 * pokazuje błąd, a callback uruchamia dopiero po rzeczywistym zapisie tekstu.
 */
export async function copyTextAndNotifySuccess(
  text: string,
  onSuccess?: () => void,
  clipboard: Pick<Clipboard, 'writeText'> = navigator.clipboard,
): Promise<void> {
  await clipboard.writeText(text);
  onSuccess?.();
}
