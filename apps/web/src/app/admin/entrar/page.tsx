import { EmailLoginForm } from '@/components/EmailLoginForm';

export default function AdminEntrarPage() {
  return <EmailLoginForm title="Admin da Plataforma" expectedRole="ADMIN" redirectTo="/admin" />;
}
