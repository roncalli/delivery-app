import { EmailLoginForm } from '@/components/EmailLoginForm';

export default function LojistaEntrarPage() {
  return (
    <EmailLoginForm title="Painel do Lojista" expectedRole="STORE_OWNER" redirectTo="/lojista" />
  );
}
