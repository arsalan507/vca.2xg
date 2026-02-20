import { useState, type FormEvent, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Key,
  LogOut,
  Check,
  Bell,
  Moon,
  Calendar,
  Clock,
  Camera,
  Pencil,
  X,
  Save,
} from 'lucide-react';
import Header from '@/components/Header';
import { Button } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/api';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, role, signOut } = useAuth();

  // Profile editing state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');

  // PIN state
  const [currentPin, setCurrentPin] = useState(['', '', '', '']);
  const [newPin, setNewPin] = useState(['', '', '', '']);
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const currentPinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const newPinRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Notification preferences
  const [notifications, setNotifications] = useState({
    newScripts: true,
    approvals: true,
    mentions: true,
    dailyDigest: false,
  });

  // Theme preference
  const [darkMode, setDarkMode] = useState(false);

  // Initialize edit name from user data
  useEffect(() => {
    const name = (user?.user_metadata?.full_name as string) || '';
    setEditName(name);
  }, [user]);

  const handlePinInput = (
    pins: string[],
    setPins: React.Dispatch<React.SetStateAction<string[]>>,
    refs: React.RefObject<(HTMLInputElement | null)[]>,
    index: number,
    value: string
  ) => {
    if (!/^\d*$/.test(value)) return;
    const newPins = [...pins];
    newPins[index] = value.slice(-1);
    setPins(newPins);
    if (value && index < 3 && refs.current) {
      refs.current[index + 1]?.focus();
    }
  };

  const handlePinKeyDown = (
    pins: string[],
    refs: React.RefObject<(HTMLInputElement | null)[]>,
    index: number,
    e: React.KeyboardEvent
  ) => {
    if (e.key === 'Backspace' && !pins[index] && index > 0 && refs.current) {
      refs.current[index - 1]?.focus();
    }
  };

  const handleChangePin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    const currentPinValue = currentPin.join('');
    const newPinValue = newPin.join('');

    if (currentPinValue.length !== 4 || newPinValue.length !== 4) {
      setError('Both PINs must be 4 digits');
      return;
    }

    setIsChangingPin(true);

    try {
      const { error } = await auth.changePin({ currentPin: currentPinValue, newPin: newPinValue });
      if (error) {
        setError(error.message);
        toast.error(error.message);
      } else {
        setSuccess(true);
        setCurrentPin(['', '', '', '']);
        setNewPin(['', '', '', '']);
        toast.success('PIN updated successfully');
      }
    } catch {
      setError('Failed to change PIN');
      toast.error('Failed to change PIN');
    } finally {
      setIsChangingPin(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    try {
      // TODO: Implement API call to update profile
      toast.success('Profile updated successfully');
      setIsEditingProfile(false);
    } catch {
      toast.error('Failed to update profile');
    }
  };

  const handleSignOut = () => {
    signOut(); // clears session instantly — ProtectedRoute redirects to /login automatically
  };

  const getRoleDisplay = (r: string | null) => {
    switch (r) {
      case 'admin':
      case 'super_admin':
      case 'SUPER_ADMIN':
        return 'Administrator';
      case 'script_writer':
      case 'SCRIPT_WRITER':
        return 'Script Writer';
      case 'videographer':
      case 'VIDEOGRAPHER':
        return 'Videographer';
      case 'editor':
      case 'EDITOR':
        return 'Editor';
      case 'posting_manager':
      case 'POSTING_MANAGER':
        return 'Posting Manager';
      default:
        return r || 'User';
    }
  };

  const getRoleIcon = (r: string | null) => {
    switch (r) {
      case 'admin':
      case 'super_admin':
      case 'SUPER_ADMIN':
        return '🛡️';
      case 'script_writer':
      case 'SCRIPT_WRITER':
        return '✍️';
      case 'videographer':
      case 'VIDEOGRAPHER':
        return '🎥';
      case 'editor':
      case 'EDITOR':
        return '✂️';
      case 'posting_manager':
      case 'POSTING_MANAGER':
        return '📱';
      default:
        return '👤';
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email?.substring(0, 2).toUpperCase() || 'U';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const fullName = (user?.user_metadata?.full_name as string) || 'User';
  const createdAt = user?.created_at;
  const lastSignIn = user?.last_sign_in_at;

  return (
    <>
      <Header title="Settings" showBack />

      <div className="px-4 py-4 pb-24 space-y-4">
        {/* Profile Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-100 overflow-hidden"
        >
          {/* Profile Header with Gradient */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-4 pb-12 relative">
            <h3 className="text-white font-semibold">My Profile</h3>
          </div>

          {/* Profile Card overlapping header */}
          <div className="px-4 -mt-8">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start gap-4">
                {/* Avatar with edit button */}
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                    {getInitials(fullName, user?.email)}
                  </div>
                  <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                    <Camera className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                </div>

                <div className="flex-1 min-w-0">
                  {isEditingProfile ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                        placeholder="Enter your name"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveProfile}
                          className="flex items-center gap-1 px-3 py-1 bg-purple-500 text-white text-xs font-medium rounded-lg"
                        >
                          <Save className="w-3 h-3" />
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setIsEditingProfile(false);
                            setEditName(fullName);
                          }}
                          className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg"
                        >
                          <X className="w-3 h-3" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{fullName}</h3>
                        <button
                          onClick={() => setIsEditingProfile(true)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Pencil className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                      </div>
                      <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                    </>
                  )}

                  <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded-full">
                    <span>{getRoleIcon(role)}</span>
                    {getRoleDisplay(role)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Account Info */}
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-3 py-2">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">Member since</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(createdAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 py-2">
              <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
                <Clock className="w-4 h-4 text-gray-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500">Last sign in</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(lastSignIn)}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Notification Preferences */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-xl border border-gray-100 p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Notifications</h3>
          </div>

          <div className="space-y-1">
            <NotificationToggle
              label="New Scripts"
              description="When a new script is submitted for review"
              enabled={notifications.newScripts}
              onChange={(v) => setNotifications({ ...notifications, newScripts: v })}
            />
            <NotificationToggle
              label="Approvals & Rejections"
              description="When your scripts are approved or rejected"
              enabled={notifications.approvals}
              onChange={(v) => setNotifications({ ...notifications, approvals: v })}
            />
            <NotificationToggle
              label="Mentions"
              description="When someone mentions you in comments"
              enabled={notifications.mentions}
              onChange={(v) => setNotifications({ ...notifications, mentions: v })}
            />
            <NotificationToggle
              label="Daily Digest"
              description="Daily summary of activity"
              enabled={notifications.dailyDigest}
              onChange={(v) => setNotifications({ ...notifications, dailyDigest: v })}
            />
          </div>
        </motion.div>

        {/* Appearance */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl border border-gray-100 p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Moon className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Appearance</h3>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-900">Dark Mode</p>
              <p className="text-xs text-gray-500">Switch to dark theme</p>
            </div>
            <button
              onClick={() => {
                setDarkMode(!darkMode);
                toast('Dark mode coming soon!', { icon: '🌙' });
              }}
              className={`w-11 h-6 rounded-full relative transition-colors ${
                darkMode ? 'bg-purple-500' : 'bg-gray-300'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  darkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </motion.div>

        {/* Change PIN Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-xl border border-gray-100 p-4"
        >
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Change PIN</h3>
          </div>

          <form onSubmit={handleChangePin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Current PIN</label>
              <div className="flex gap-2 justify-center">
                {currentPin.map((digit, i) => (
                  <input
                    key={`current-${i}`}
                    ref={el => { currentPinRefs.current[i] = el; }}
                    type="tel"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinInput(currentPin, setCurrentPin, currentPinRefs, i, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(currentPin, currentPinRefs, i, e)}
                    className="w-12 h-12 text-center text-xl font-bold border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none"
                    autoComplete="off"
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New PIN</label>
              <div className="flex gap-2 justify-center">
                {newPin.map((digit, i) => (
                  <input
                    key={`new-${i}`}
                    ref={el => { newPinRefs.current[i] = el; }}
                    type="tel"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handlePinInput(newPin, setNewPin, newPinRefs, i, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(newPin, newPinRefs, i, e)}
                    className="w-12 h-12 text-center text-xl font-bold border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none"
                    autoComplete="off"
                  />
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700 flex items-center gap-2">
                <Check className="w-4 h-4" />
                PIN updated successfully
              </div>
            )}

            <Button
              type="submit"
              fullWidth
              isLoading={isChangingPin}
            >
              Update PIN
            </Button>
          </form>
        </motion.div>

        {/* Sign Out Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl border border-gray-100 p-4"
        >
          <Button
            variant="danger"
            fullWidth
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </motion.div>
      </div>
    </>
  );
}

function NotificationToggle({
  label,
  description,
  enabled,
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`w-11 h-6 rounded-full relative transition-colors ${
          enabled ? 'bg-purple-500' : 'bg-gray-300'
        }`}
      >
        <div
          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
